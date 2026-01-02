# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - heading "404" [level=1] [ref=e5]
    - heading "This page could not be found." [level=2] [ref=e7]
  - generic [ref=e9]:
    - link "探す" [ref=e10] [cursor=pointer]:
      - /url: /
      - img [ref=e12]
      - generic [ref=e15]: 探す
    - link "保存済み" [ref=e16] [cursor=pointer]:
      - /url: /bookmarks
      - img [ref=e18]
      - generic [ref=e20]: 保存済み
    - link "メッセージ" [ref=e21] [cursor=pointer]:
      - /url: /messages
      - img [ref=e23]
      - generic [ref=e25]: メッセージ
    - link "仕事管理" [ref=e26] [cursor=pointer]:
      - /url: /my-jobs
      - img [ref=e28]
      - generic [ref=e31]: 仕事管理
    - link "マイページ" [ref=e32] [cursor=pointer]:
      - /url: /mypage
      - img [ref=e34]
      - generic [ref=e37]: マイページ
  - alert [ref=e38]
```