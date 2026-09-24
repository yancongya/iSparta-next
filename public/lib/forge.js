/**
 * isparta - Forge (aerender Launcher & Monitor)
 * 自 RenderSmith/js/forge.js 拷贝升级：后台 aerender 启停 / PROGRESS / ETA / 挂起检测
 * Handles background rendering via child_process.spawn
 */

var ispartaForge = (function () {
    'use strict';

    var spawn = require('child_process').spawn;
    var exec = require('child_process').exec;
    var path = require('path');

    // RenderSmith.Config.get('shield') 的本地替身；可由 setShield 覆盖
    var _shield = {
        memCache: 50,
        memOther: 50,
        priorityHigh: true,
        // 无输出超过该毫秒数视为挂起（0=关闭）
        aerenderHangTimeoutMs: 10 * 60 * 1000
    };
    function setShield (cfg) {
        if (cfg && typeof cfg === 'object') {
            for (var k in cfg) {
                if (Object.prototype.hasOwnProperty.call(cfg, k)) { _shield[k] = cfg[k]; }
            }
        }
        return _shield;
    }

    var _process = null;
    var _isRendering = false;
    var _startTime = null;
    var _currentFrame = 0;
    var _totalFrames = 0;
    var _frameTimes = [];       // Recent frame render times for ETA calculation
    var _lastFrameTime = null;
    var _stderrBuffer = '';
    var _stdoutBuffer = '';     // Collect stdout for error pattern detection
    var _lastOutputTime = 0;    // RB-2: last stdout activity timestamp for hang detection
    var _hangCheckIntervalId = null;
    var _hangAborted = false;   // True when we aborted due to hang (distinguishes from user abort)

    // Shift-JIS decoder for Japanese Windows aerender output.
    // aerender uses the system OEM codepage (cp932 / Shift-JIS on JP Windows).
    // CEP Chromium includes full ICU so TextDecoder('shift-jis') is available.
    var _sjisDecoder = null;
    try { _sjisDecoder = new TextDecoder('shift-jis'); } catch (e) {}

    /**
     * Decode aerender output buffer with automatic encoding detection.
     * Tries UTF-8 first; if it produces replacement chars (U+FFFD),
     * falls back to Shift-JIS for Japanese Windows compatibility.
     */
    function _decodeOutput(data) {
        var utf8 = data.toString('utf-8');
        if (utf8.indexOf('\ufffd') >= 0 && _sjisDecoder) {
            try { return _sjisDecoder.decode(data); } catch (e) {}
        }
        return utf8;
    }

    // Callbacks
    var _onProgress = null;
    var _onComplete = null;
    var _onError = null;
    var _onLog = null;

    // aerender stdout patterns
    // Standard aerender: "PROGRESS:  0;00;01;00 (26): 0 Seconds"
    // Must NOT match "(1 of 3)" - use negative lookahead via two-step check
    var AERENDER_FRAME_REGEX = /PROGRESS:.*\((\d+)\)\s*:/;
    // Composition completion: "Finished Composition ... (1 of 3)"
    var COMP_OF_REGEX = /\((\d+)\s+of\s+(\d+)\)/i;
    // Fallback: "Frame X of Y" (some localized versions)
    var FRAME_REGEX = /Frame\s+(\d+)\s+of\s+(\d+)/i;

    /**
     * Build aerender command arguments for Single Comp mode
     */
    function buildSingleArgs(options) {
        var memCache = String(options.memCache || 50);
        var memOther = String(options.memOther || 50);
        var args = [
            '-project', options.projectPath,
            '-comp', options.compName,
            '-output', options.outputPath,
            '-mem_usage', memCache, memOther
        ];

        // 仅在给出帧范围时传 -s/-e；否则 aerender 走合成工作区
        var hasRange = (options.endFrame != null && options.endFrame !== '') ||
            (options.totalFrames && options.totalFrames > 0);
        if (hasRange) {
            args.push('-s', String(options.startFrame || 0));
            args.push('-e', String(
                options.endFrame != null && options.endFrame !== ''
                    ? options.endFrame
                    : (options.totalFrames - 1)
            ));
        }

        if (options.rsTemplate) {
            args.push('-RStemplate', options.rsTemplate);
        }
        if (options.omTemplate) {
            args.push('-OMtemplate', options.omTemplate);
        }

        return args;
    }

    /**
     * Build aerender command arguments for Batch Queue mode
     */
    function buildBatchArgs(options) {
        var memCache = String(options.memCache || 50);
        var memOther = String(options.memOther || 50);
        var args = [
            '-project', options.projectPath,
            '-mem_usage', memCache, memOther
        ];

        return args;
    }

    /**
     * Set aerender process to High priority using PowerShell (Win11 compatible)
     * Targets specific PID to avoid affecting other aerender instances
     */
    function setPriorityHigh(pid) {
        if (!pid) return;

        var cmd = 'powershell -Command "try { $p = Get-Process -Id ' + pid +
            ' -ErrorAction Stop; $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High } catch {}"';

        exec(cmd, function (err) {
            if (err) {
                console.warn('[Forge] Priority set failed (non-critical): ' + err.message);
            } else {
                console.log('[Forge] aerender (PID ' + pid + ') priority set to High');
                if (_onLog) _onLog('[Forge] Priority: High');
            }
        });
    }

    /**
     * Parse aerender stdout line for progress info
     */
    function parseProgress(line) {
        var current = null;
        var updateTotal = false;
        var parsedTotal = 0;

        // Try standard aerender frame progress: "PROGRESS:  0;00;01;00 (26): 0 Seconds"
        var match = line.match(AERENDER_FRAME_REGEX);
        if (match) {
            current = parseInt(match[1], 10);
        }

        // Try "Frame X of Y" fallback
        if (current === null) {
            match = line.match(FRAME_REGEX);
            if (match) {
                current = parseInt(match[1], 10);
                parsedTotal = parseInt(match[2], 10);
                updateTotal = true;
            }
        }

        // Skip "Finished Composition (X of Y)" lines -- they would clobber
        // _totalFrames in single mode where we already know the real total.

        if (current !== null) {
            // Track frame render times for ETA
            var now = Date.now();
            if (_lastFrameTime && current > _currentFrame) {
                var frameDelta = current - _currentFrame;
                var timeDelta = now - _lastFrameTime;
                var timePerFrame = timeDelta / frameDelta;
                _frameTimes.push(timePerFrame);
                // Keep last 30 samples for rolling average
                if (_frameTimes.length > 30) {
                    _frameTimes.shift();
                }
            }
            _lastFrameTime = now;

            _currentFrame = current;
            // Only update _totalFrames if we parsed it AND we don't already
            // have a known total from comp info
            if (updateTotal && parsedTotal > 0 && _totalFrames === 0) {
                _totalFrames = parsedTotal;
            }

            return {
                currentFrame: current,
                totalFrames: _totalFrames,
                percentage: _totalFrames > 0 ? Math.round((current / _totalFrames) * 100) : 0
            };
        }

        return null;
    }

    /**
     * Calculate ETA based on rolling average of frame render times
     */
    function calculateETA() {
        if (_frameTimes.length < 3 || _totalFrames === 0) {
            return null;
        }

        // Rolling average of recent frame times
        var sum = 0;
        for (var i = 0; i < _frameTimes.length; i++) {
            sum += _frameTimes[i];
        }
        var avgTimePerFrame = sum / _frameTimes.length;

        var remainingFrames = _totalFrames - _currentFrame;
        var remainingMs = remainingFrames * avgTimePerFrame;
        var elapsed = Date.now() - _startTime;

        return {
            elapsed: elapsed,
            remaining: Math.max(0, remainingMs),
            total: elapsed + remainingMs,
            completionTime: new Date(Date.now() + remainingMs),
            avgFrameTime: avgTimePerFrame
        };
    }

    /**
     * Detect AE render errors hidden in aerender stdout/stderr
     * even when exit code is 0.
     *
     * Patterns to detect (English + Japanese Shift-JIS mojibake):
     *   - "error code" / Shift-JIS: \x83G\x83\x89\x81[ (error) + \x83R\x81[\x83h (code)
     *   - "WARNING:After Effects" with error count
     *   - "Unexpected error" in composition output
     *   - No frames rendered (0 PROGRESS frames detected)
     *
     * @param {string} stdout - Collected stdout text
     * @param {string} stderr - Collected stderr text
     * @returns {string|null} Error message, or null if no error detected
     */
    function detectAeRenderError(stdout, stderr) {
        var combined = (stdout || '') + '\n' + (stderr || '');

        // Filter out benign XMP metadata warnings before error detection.
        // AE frequently emits "WARNING: XMP metadata could not be written" which
        // is non-fatal and does not affect render output. Remove the entire
        // WARNING line that contains XMP so it doesn't trigger error patterns.
        // English: "XMP metadata", Japanese Shift-JIS mojibake: "XMP"
        combined = combined.replace(/[^\n]*WARNING[^\n]*XMP[^\n]*/gi, '');

        // Pattern 1: English error indicators
        if (/error code\s*:\s*[\\]?[1-9]/i.test(combined)) {
            return extractErrorSummary(combined, 'AE render error (error code detected)');
        }

        // Pattern 2: WARNING with error count (English)
        var warnMatch = combined.match(/WARNING:.*?(\d+)\s+error/i);
        if (warnMatch) {
            return extractErrorSummary(combined, 'AE reported ' + warnMatch[1] + ' error(s) during render');
        }

        // Pattern 3: Shift-JIS mojibake patterns for Japanese AE
        // "エラーコード" in Shift-JIS read as UTF-8 contains "\x83G\x83\x89" sequence
        // which appears in the mojibake as specific byte patterns.
        // Detect the WARNING line with error count (Japanese):
        // "WARNING:After Effects 警告: XX のエラーがログされました"
        // In mojibake: "WARNING:After Effects" is still ASCII-readable
        var jaWarnMatch = combined.match(/WARNING:After Effects[^\n]*?(\d+)/);
        if (jaWarnMatch && parseInt(jaWarnMatch[1], 10) > 0) {
            return 'AE reported ' + jaWarnMatch[1] + ' error(s) during render';
        }

        // Pattern 4: "error code : \1" (appears in both EN and JA output)
        if (/\\1/.test(combined) && /PROGRESS:/.test(combined)) {
            // \1 error code only relevant if it appears in aerender output context
            // Check for the pattern near error-like context
            var lines = combined.split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (/\\1/.test(line) && !/PROGRESS:.*\(\d+\)\s*:/.test(line)) {
                    // This \1 is an error code, not a progress frame number
                    return extractErrorSummary(combined, 'AE render error (error code \\1)');
                }
            }
        }

        // Pattern 5: No frames were rendered at all (0 progress updates)
        // Only flag this if we expected frames but got none
        if (_totalFrames > 0 && _currentFrame === 0) {
            // Check if there was at least some PROGRESS output (aerender did start)
            if (/PROGRESS:/.test(combined)) {
                return 'No frames rendered (0/' + _totalFrames + ' frames completed)';
            }
        }

        return null;
    }

    /**
     * Extract a readable error summary from aerender output.
     * Tries to find the WARNING line which usually contains the root cause.
     */
    function extractErrorSummary(combined, fallback) {
        // Try to extract the WARNING line (usually most informative)
        var warnLine = combined.match(/WARNING:[^\n]*/);
        if (warnLine) {
            var msg = warnLine[0];
            // Truncate if too long (Shift-JIS mojibake can be verbose)
            if (msg.length > 200) msg = msg.substring(0, 200) + '...';
            return msg;
        }
        return fallback;
    }

    /**
     * Check whether a process with the given PID is still alive.
     * Uses `process.kill(pid, 0)` which sends signal 0 -- a no-op that
     * only verifies signalability. Throws ESRCH if the process is gone.
     * @param {number} pid
     * @returns {boolean} true if alive, false if gone / invalid
     */
    function isProcessAlive(pid) {
        if (!pid) return false;
        try {
            process.kill(pid, 0);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Format milliseconds to HH:MM:SS
     */
    function formatTime(ms) {
        var totalSeconds = Math.floor(ms / 1000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;

        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }

    /**
     * Launch aerender process
     * @param {string} aerenderPath - Path to aerender.exe
     * @param {object} options - Render options
     * @param {object} callbacks - { onProgress, onComplete, onError, onLog }
     */
    function launch(aerenderPath, options, callbacks) {
        if (_isRendering) {
            if (callbacks.onError) callbacks.onError({
                message: 'Already rendering', code: -1, stderr: ''
            });
            return;
        }

        _onProgress = callbacks.onProgress || null;
        _onComplete = callbacks.onComplete || null;
        _onError = callbacks.onError || null;
        _onLog = callbacks.onLog || null;

        // Reset state
        _currentFrame = 0;
        _totalFrames = options.totalFrames || 0;
        _frameTimes = [];
        _lastFrameTime = null;
        _stderrBuffer = '';
        _stdoutBuffer = '';
        _startTime = Date.now();
        _lastOutputTime = _startTime;
        _hangAborted = false;
        _isRendering = true;

        // Inject shield config if not already set
        {
            var shield = _shield;
            if (!options.memCache) {
                options.memCache = shield.memCache || 50;
                options.memOther = shield.memOther || 50;
            }
            // MFR: controlled via AE preferences (shieldMfrKill/Restore in shield.jsx)
            // No aerender flags needed — aerender reads AE's preference file
        }

        // Build arguments based on mode
        var args;
        if (options.mode === 'batch') {
            args = buildBatchArgs(options);
        } else {
            args = buildSingleArgs(options);
        }

        console.log('[Forge] Launching: ' + aerenderPath);
        console.log('[Forge] Args: ' + JSON.stringify(args));
        if (_onLog) _onLog('[Forge] Starting aerender...');

        try {
            _process = spawn(aerenderPath, args, {
                windowsHide: true
            });
        } catch (e) {
            _isRendering = false;
            if (_onError) _onError({
                message: 'Failed to spawn aerender: ' + e.message,
                code: -1, stderr: ''
            });
            return;
        }

        // stdout: progress monitoring + error pattern collection
        _process.stdout.on('data', function (data) {
            var text = _decodeOutput(data);
            // RB-2: any stdout activity resets the hang detection clock
            _lastOutputTime = Date.now();
            // Keep last 4000 chars of stdout for error detection at exit
            _stdoutBuffer += text;
            if (_stdoutBuffer.length > 4000) {
                _stdoutBuffer = _stdoutBuffer.slice(-4000);
            }

            var lines = text.split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;

                if (_onLog) _onLog(line);

                var progress = parseProgress(line);
                if (progress && _onProgress) {
                    var eta = calculateETA();
                    _onProgress({
                        currentFrame: progress.currentFrame,
                        totalFrames: progress.totalFrames,
                        percentage: progress.percentage,
                        elapsed: _startTime ? Date.now() - _startTime : 0,
                        eta: eta
                    });
                }
            }
        });

        // stderr: error logging
        _process.stderr.on('data', function (data) {
            var text = _decodeOutput(data);
            // RB-2: stderr counts as activity too
            _lastOutputTime = Date.now();
            _stderrBuffer += text;
            // Keep only last 2000 chars of stderr
            if (_stderrBuffer.length > 2000) {
                _stderrBuffer = _stderrBuffer.slice(-2000);
            }
            console.warn('[Forge stderr] ' + text.trim());
        });

        // RB-2: aerender hang detection.
        // If stdout/stderr has been silent for hangTimeoutMs, assume the
        // process is hung (deadlock, waiting on user dialog inside AE, etc.)
        // and force-abort. User can disable by setting the config to 0.
        var hangTimeoutMs = 0;
        if (_shield) {
            var shieldCfgHang = _shield;
            hangTimeoutMs = shieldCfgHang.aerenderHangTimeoutMs || 0;
        }
        if (hangTimeoutMs > 0) {
            _hangCheckIntervalId = setInterval(function () {
                if (!_isRendering) {
                    // Safety: interval somehow survived cleanup
                    if (_hangCheckIntervalId) {
                        clearInterval(_hangCheckIntervalId);
                        _hangCheckIntervalId = null;
                    }
                    return;
                }
                var silence = Date.now() - _lastOutputTime;

                // Process-liveness recovery: after 60s of silence, check if
                // aerender.exe is actually still alive. On some systems the
                // 'close' event on child_process.spawn fails to fire even
                // after aerender exits (the spawned headless AE subprocess
                // can outlive aerender.exe and block Node's cleanup hook).
                // If process is gone but we're still "rendering", force
                // recovery so the UI doesn't stay stuck at 100%.
                if (silence > 60000 && _process && _process.pid) {
                    if (!isProcessAlive(_process.pid)) {
                        console.warn('[Forge] aerender process gone but close event not received, recovering...');
                        if (_onLog) _onLog('[Forge] Process gone, recovering from missed close event...');

                        clearInterval(_hangCheckIntervalId);
                        _hangCheckIntervalId = null;

                        var recoveredPid = _process.pid;
                        var elapsedAtRecovery = _startTime ? Date.now() - _startTime : 0;

                        // Verify output file exists and has reasonable size
                        // before declaring success. If missing / tiny, treat
                        // as error so user knows something went wrong.
                        var outputPath = options && options.outputPath ? options.outputPath : '';
                        var outputOk = false;
                        if (outputPath) {
                            try {
                                var fs = require('fs');
                                var st = fs.statSync(outputPath);
                                if (st && st.size > 1024) outputOk = true;
                            } catch (eStat) {}
                        } else {
                            // Batch mode uses multiple output paths from RQ;
                            // we can't verify all here. Trust frame progress
                            // as a proxy for completion. aerender may skip
                            // some PROGRESS lines (throttling) so the last
                            // reported frame often falls 1-3 frames short of
                            // total. 95% threshold tolerates this gap while
                            // still catching genuine mid-render deaths.
                            outputOk = (_totalFrames > 0 && _currentFrame >= _totalFrames * 0.95);
                        }

                        _isRendering = false;
                        _process = null;

                        if (outputOk) {
                            console.log('[Forge] Recovered: output file present (pid=' + recoveredPid + ')');
                            if (_onComplete) {
                                _onComplete({
                                    success: true,
                                    elapsed: elapsedAtRecovery,
                                    elapsedFormatted: formatTime(elapsedAtRecovery),
                                    totalFrames: _totalFrames,
                                    recoveredFromMissedClose: true
                                });
                            }
                        } else {
                            console.error('[Forge] Recovered: output missing / tiny (pid=' + recoveredPid + ')');
                            if (_onError) {
                                _onError({
                                    message: 'aerender exited without producing output (recovered from missed close event)',
                                    code: -1,
                                    stderr: '',
                                    elapsed: elapsedAtRecovery,
                                    elapsedFormatted: formatTime(elapsedAtRecovery),
                                    lastFrame: _currentFrame,
                                    totalFrames: _totalFrames
                                });
                            }
                        }
                        return;
                    }
                }

                if (silence > hangTimeoutMs) {
                    var silenceMin = Math.round(silence / 60000);
                    console.error('[Forge] Hang detected: no aerender output for ' + silenceMin + ' minutes. Auto-aborting.');
                    if (_onLog) _onLog('[Forge] Hang detected (' + silenceMin + ' min no output), aborting...');
                    _hangAborted = true;
                    clearInterval(_hangCheckIntervalId);
                    _hangCheckIntervalId = null;
                    // abort() fires taskkill; the 'close' handler will see the
                    // non-zero exit and call _onError. We override the message
                    // there via _hangAborted flag.
                    abort();
                }
            }, 30000); // Check every 30 seconds
        }

        // Process exit
        _process.on('close', function (code) {
            var elapsed = _startTime ? Date.now() - _startTime : 0;
            _isRendering = false;
            _process = null;
            if (_hangCheckIntervalId) {
                clearInterval(_hangCheckIntervalId);
                _hangCheckIntervalId = null;
            }

            // RB-2: hang-aborted takes priority over exit code interpretation
            if (_hangAborted) {
                var silenceAtAbort = Math.round((Date.now() - _lastOutputTime) / 60000);
                var hangMsg = 'aerender auto-aborted: no output for ~' + silenceAtAbort + ' minutes (hang detection)';
                console.error('[Forge] ' + hangMsg);
                if (_onError) {
                    _onError({
                        message: hangMsg,
                        code: code,
                        stderr: 'Auto-aborted by isparta hang detection. Adjust shield.aerenderHangTimeoutMs to tune.',
                        elapsed: elapsed,
                        elapsedFormatted: formatTime(elapsed),
                        lastFrame: _currentFrame,
                        totalFrames: _totalFrames,
                        hangDetected: true
                    });
                }
                return;
            }

            if (code === 0) {
                // aerender exits 0 even when AE encounters render errors.
                // Check stdout for error patterns before declaring success.
                var hiddenError = detectAeRenderError(_stdoutBuffer, _stderrBuffer);

                if (hiddenError) {
                    console.error('[Forge] aerender exited 0 but AE reported errors: ' + hiddenError);
                    if (_onError) {
                        _onError({
                            message: hiddenError,
                            code: 0,
                            stderr: hiddenError,
                            elapsed: elapsed,
                            elapsedFormatted: formatTime(elapsed),
                            lastFrame: _currentFrame,
                            totalFrames: _totalFrames
                        });
                    }
                } else {
                    console.log('[Forge] Render completed successfully');
                    if (window.__rsLog) window.__rsLog.add('info', 'Forge', '渲染完成', { elapsed: formatTime(elapsed), frames: _totalFrames });
                    if (_onComplete) {
                        _onComplete({
                            success: true,
                            elapsed: elapsed,
                            elapsedFormatted: formatTime(elapsed),
                            totalFrames: _totalFrames
                        });
                    }
                }
            } else {
                var errMsg = 'aerender exited with code ' + code;
                // Extract last few lines of stderr for error context
                var stderrLines = _stderrBuffer.trim().split(/\r?\n/);
                var errorContext = stderrLines.slice(-5).join('\n');
                console.error('[Forge] ' + errMsg);
                if (window.__rsLog) window.__rsLog.add('error', 'Forge', errMsg, { code: code, stderr: errorContext.slice(0, 200) });
                if (_onError) {
                    _onError({
                        message: errMsg,
                        code: code,
                        stderr: errorContext,
                        elapsed: elapsed,
                        elapsedFormatted: formatTime(elapsed),
                        lastFrame: _currentFrame,
                        totalFrames: _totalFrames
                    });
                }
            }
        });

        _process.on('error', function (err) {
            _isRendering = false;
            _process = null;
            if (_hangCheckIntervalId) {
                clearInterval(_hangCheckIntervalId);
                _hangCheckIntervalId = null;
            }
            console.error('[Forge] Process error: ' + err.message);
            if (_onError) {
                _onError({
                    message: 'Process error: ' + err.message,
                    code: -1,
                    stderr: '',
                    elapsed: _startTime ? Date.now() - _startTime : 0
                });
            }
        });

        // Set priority to High after a short delay (give process time to start)
        // Controlled by shield.priorityHigh config flag
        var pid = _process.pid;
        var shieldCfg = _shield;
        var doPriority = !shieldCfg || shieldCfg.priorityHigh !== false;
        if (doPriority) {
            setTimeout(function () { setPriorityHigh(pid); }, 2000);
        } else {
            console.log('[Forge] Priority High disabled by Shield config');
        }
    }

    /**
     * Abort the current render. Cross-platform: Windows uses `taskkill /T /F`
     * to kill the entire process tree, macOS uses SIGKILL directly on the
     * spawned aerender pid.
     *
     * Safety: a 5-second watchdog forcibly clears `_isRendering` even if the
     * `'close'` event never arrives. aerender on macOS occasionally exits
     * without triggering Node's close handler, which used to leave the panel
     * stuck on "Already rendering" until restart.
     */
    function abort() {
        if (!_process || !_isRendering) {
            console.log('[Forge] Nothing to abort');
            return;
        }

        // RB-2: stop hang check — abort() either originates from hang detection
        // (already cleared) or from user/code; either way we no longer need it.
        if (_hangCheckIntervalId) {
            clearInterval(_hangCheckIntervalId);
            _hangCheckIntervalId = null;
        }

        var pid = _process.pid;
        var isMac = process.platform === 'darwin';
        console.log('[Forge] Aborting render (PID ' + pid + ', platform: ' + process.platform + ')...');
        if (_onLog) _onLog('[Forge] Aborting...');

        if (isMac) {
            // macOS: SIGKILL directly, no taskkill (which is Windows-only)
            try {
                _process.kill('SIGKILL');
                console.log('[Forge] aerender killed with SIGKILL');
            } catch (e) {
                console.warn('[Forge] SIGKILL failed: ' + e.message);
            }
        } else {
            // Windows: kill the process tree (aerender spawns headless AE)
            exec('taskkill /T /F /PID ' + pid, function (err) {
                if (err) {
                    console.warn('[Forge] taskkill failed, trying process.kill: ' + err.message);
                    try {
                        if (_process) _process.kill();
                    } catch (e) {
                        // Process already dead
                    }
                } else {
                    console.log('[Forge] Process tree killed via taskkill');
                }
            });
        }

        // Watchdog: if 'close' doesn't fire within 5s, force-reset state so
        // the panel doesn't stay stuck on "Already rendering".
        setTimeout(function () {
            if (_isRendering) {
                console.warn('[Forge] close event did not arrive within 5s of abort; force-resetting state');
                if (_onLog) _onLog('[Forge] Force-resetting state (close event missed)');
                _isRendering = false;
                _process = null;
            }
        }, 5000);
    }

    /**
     * Check if currently rendering
     */
    function isRendering() {
        return _isRendering;
    }

    /**
     * Get current render state
     */
    function getState() {
        return {
            isRendering: _isRendering,
            currentFrame: _currentFrame,
            totalFrames: _totalFrames,
            elapsed: _startTime ? Date.now() - _startTime : 0,
            eta: calculateETA()
        };
    }

    return {
        launch: launch,
        abort: abort,
        isRendering: isRendering,
        getState: getState,
        formatTime: formatTime,
        setShield: setShield,
        buildSingleArgs: buildSingleArgs,
        buildBatchArgs: buildBatchArgs,
        parseProgress: parseProgress,
        detectAeRenderError: detectAeRenderError
    };
})();

if (typeof module === 'object' && module.exports) {
    module.exports = ispartaForge;
}
if (typeof window !== 'undefined') {
    window.ispartaForge = ispartaForge;
}
