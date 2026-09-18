# 落地页 SEO / 搜索收录提交清单

> 产品页：https://yancongya.github.io/iSparta-next/  
> 仓库：https://github.com/yancongya/iSparta-next  
> 状态：页面 meta / robots / sitemap / JSON-LD 已具备；**收录依赖搜索引擎提交与外链**。

## 为什么搜不到（结论）

1. 落地页在 **`github.io` 子域**，权重通常低于 `github.com` 仓库页  
2. 关键词 **「iSparta」** 被原版与大量历史网页占位，「iSparta-next」品牌尚新  
3. **外链 / star 少**，搜索引擎缺少信任信号  
4. 若从未提交 sitemap，抓取可能很慢甚至暂未收录  

技术标签不是主因；**提交 + 外链 + 时间** 才是。

---

## 一、Google Search Console（必做）

1. 打开 [Search Console](https://search.google.com/search-console) → 添加资源  
2. 选择 **URL 前缀** → 填入：`https://yancongya.github.io/iSparta-next/`  
3. 验证方式（任选其一）：  
   - **HTML tag**：把 Google 给的 `<meta name="google-site-verification" ...>` 加到 `landing/index.html` 的 `<head>` 后重新部署 Pages  
   - 或 DNS / 其它方式（子域路径站常用 HTML tag）  
4. 提交 Sitemap：`https://yancongya.github.io/iSparta-next/sitemap.xml`  
5. 使用 **URL 检查** → 对首页执行 **请求编入索引 / Request Indexing**  
6. 数日后用下面命令查看是否收录  

```text
site:yancongya.github.io/iSparta-next
site:yancongya.github.io "iSparta-next"
```

---

## 二、Bing Webmaster（建议）

1. 打开 [Bing Webmaster Tools](https://www.bing.com/webmasters)  
2. 添加 `https://yancongya.github.io/iSparta-next/`  
3. 导入 Google Search Console（若已验证）或手动验证  
4. 提交同一 sitemap URL  

---

## 三、可选：百度站长平台

- 百度对 **github.io** 收录往往更差，可作补充  
- 搜索「百度搜索资源平台」→ 站点管理 → 提交 sitemap  
- 若长期面向国内搜索，更建议将来绑定**自有域名**并做 ICP 相关合规（若需）  

---

## 四、外链与入口（比改 meta 更重要）

| 动作 | 说明 |
| --- | --- |
| GitHub About → Website | 保持为落地页 URL |
| README / README.en 顶部 | 产品页链接（已有，可再加「官网」字样） |
| Release Notes | 每条可附产品页链接 |
| 技术社区 | 掘金 / 知乎 / CSDN / V2EX 等介绍文里贴完整 URL |
| 其它仓库 / 列表 | Awesome 列表、工具导航站（符合其收录规则时） |

完整 URL 示例：

```text
https://yancongya.github.io/iSparta-next/
```

---

## 五、页面内已具备的 SEO 要素

- `<title>`：突出 **iSparta-next 官网** + 格式关键词 + iSparta 替代  
- `description` / `keywords`：长尾与品牌区分  
- `canonical` + `robots: index, follow`  
- Open Graph / Twitter Card  
- JSON-LD `SoftwareApplication`  
- `robots.txt` → `sitemap.xml`  
- **静态 About 区块**（`#about`）：不依赖 JS 的产品说明正文  

版本号与更新日志为**运行时读 GitHub API**，利于实时性；SEO 主要依赖上述静态文案与收录提交。

---

## 六、验证清单（做完勾选）

- [ ] Google Search Console 已验证并提交 sitemap  
- [ ] Bing 已提交  
- [ ] `site:yancongya.github.io/iSparta-next` 有结果（或已 Request Indexing）  
- [ ] README / 社区至少一处外链到落地页  
- [ ] 搜索 `iSparta-next` 时能观察到落地页或仓库（持续优化）  

---

## 七、中期建议

- 自定义域名绑定 GitHub Pages（品牌词与信任度更好）  
- 保持发版与 Release Notes 更新，增加「新鲜度」信号  
- 不要在客户端暴露任何 API Token（当前匿名 API + 会话缓存，符合安全实践）  
