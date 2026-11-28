# Kế hoạch: routing mặc định Claude + lead tự học từ yêu cầu người dùng

Trạng thái: **đã tích hợp** (chưa commit) · Ngày: 2026-11-28 · 71/71 test qua

Khác với bản kế hoạch:
- Khi người dùng đổi effort của một model, các role đã lưu dùng cùng model đó **đổi theo** và kit báo lại, thay vì báo lỗi xung đột.
- Chưa có cảnh báo sớm "opencode dùng danh sách thinking của omp": ping đã bắt được variant sai.
- Routing mặc định của kit lấy theo `.desk/team.json` đã chỉnh của repo này (designer opus, tester/scout `opencode-go/hy4-flash-free@high`, writer opencode deepseek, engineer sonnet → deepseek). Candidate nào máy không có thì tự bỏ qua. Không đưa vào mặc định: `test.command`, các trường `learned`.
- Thêm role `scout` (worker Orca chỉ đọc).
- Sửa thêm một lỗi cũ trên macOS: `deskRoot` so sánh `/var/…` với `/private/var/…`, khiến hook tưởng mình là worker. 13 test đã fail vì lỗi này.

## Bối cảnh

Khi lead điều phối worker, nó chọn agent, model và effort theo `.desk/team.json` → `routing.roles`. Mỗi role khai báo `use` / `fallback` / `escalate`, mỗi mục dạng `agent:model@effort`.

Ở workspace `wallpaper` (`/Volumes/Hub/App/wallpaper`), lead đã dispatch worker nhiều lần nhưng `team.json` vẫn không có routing. Nguyên nhân:

1. **Mặc định chỉ có trong bộ nhớ.** Khi `team.json` trống, `loadTeam` (`kit/method/hooks/team.mjs:26`) sinh routing mặc định nhưng không ghi ra file. Mặc định đó chỉ có tên agent (`claude`, fallback `omp`), không có model hay effort.
2. **`team check` vẫn báo `routing: valid`.** Lead không thấy có gì phải làm.
3. **Lựa chọn của người dùng bị mất.** Lead chọn model bằng `--prefer` cho từng lần dispatch, và lựa chọn đó không được lưu. Desk của wallpaper ghi lại các lần chạy: `tester:claude:claude-haiku-5-5` ×3, `engineer:claude:claude-opus-5-5` ×2, `writer:opencode` ×2.
4. **Lưu một role làm mất mặc định của các role khác.** Chỉ cần `team.json` có một role, toàn bộ mặc định biến mất, và các role còn lại báo `no routing for role`.

## Mục tiêu

- **Mặc định là model Claude**, có sẵn model và effort ngay khi `team.json` còn trống.
- **Hướng C: tự học từ yêu cầu của người dùng.** Lúc nào người dùng nhắc agent hay model nào cho role nào, kit đều ghi lại, kể cả khi chưa dispatch. Có hai đường:
  - **Nhắc trong prompt** (mục 3b): hook `capture` phát hiện, lead chuyển câu nói thành candidate, `C route learn` kiểm tra rồi ghi.
  - **Dispatch với `--prefer X`** (mục 3): ghi khi worker chạy được bằng X.
  Những lần sau tự dùng X mà không cần `--prefer`.
- Không thêm `route set` hay `route models` để chỉnh tay. `route learn` chỉ dùng để ghi lại điều người dùng vừa nói. Không tự học khi lead tự chọn model mà người dùng không nhắc.

## Dữ kiện đã kiểm chứng trên máy

| Agent | Provider | Danh sách model | Cách truyền effort |
|---|---|---|---|
| claude | không có provider | không có lệnh liệt kê | `--effort low\|medium\|high` |
| omp | `op-go` (37), `op-zen-free` (12), `minimax-code` (11) | `omp models --json`, có mức thinking theo từng model | `--model provider/id:level` |
| opencode | `opencode-go` (31), `opencode` (11) | `opencode models`: chỉ tên, **không có variant** | `--model provider/id#variant` |
| pi | **chưa đăng nhập provider nào** | `pi --list-models`: bảng `provider model context max-out thinking images` | `--thinking off…max` (Orca: `--effort`) |

Chạy thử opencode v2.4.1 với `opencode-go/deepseek-v4.1-flash#<mức>`:
- `#low`, `#high`, `#max` chạy được.
- `#none`, `#minimal`, `#medium`, `#xhigh`, `#bogus` thất bại với `provider.no-route: Variant unavailable for opencode-go/deepseek-v4.1-flash: <mức>`, exit 1.
- Bộ `low/high/max` trùng với mức thinking mà omp báo cho `op-go/deepseek-v4.1-flash`.

Ghi chú:
- Cùng một model có thể đi qua nhiều provider: `omp:op-go/deepseek-v4.1-flash` và `opencode:opencode-go/deepseek-v4.1-flash` là hai candidate khác nhau.
- Mặc định không chặn model free (`deny: []`). Project nào muốn chặn thì đặt `team set routing.deny "*free*"`.

Routing mẫu đã kiểm tra bằng `routingErrors` / `route` của kit với danh sách model thật, và không có lỗi:

```json
"engineer": {
  "use":      ["claude:claude-sonnet-5-5@medium"],
  "fallback": ["omp:op-go/deepseek-v4.1-flash@high", "opencode:opencode-go/deepseek-v4.1-flash"]
}
```

## Thay đổi

Tất cả nằm trong `kit/method/hooks/team.mjs`, trừ chỗ nào ghi khác.

### 1. Mặc định là model Claude (`defaultRoles`)
Áp dụng khi máy có `claude`:

| Role | use | fallback |
|---|---|---|
| engineer, designer, fixer | `claude:claude-sonnet-5-5@medium` | `claude:claude-opus-5-5@high` → agent khác nếu có |
| tester, writer | `claude:claude-haiku-5-5@low` | `claude:claude-sonnet-5-5@medium` → agent khác |
| reviewer | `claude:claude-opus-5-5@high` | `claude:claude-sonnet-5-5@medium` → agent khác |
| researcher (`runs: subagent`) | `claude:claude-haiku-5-5@low` | `claude:claude-sonnet-5-5@medium` |

- "Agent khác" là omp, pi, opencode hoặc codex nếu có trên máy, ghi tên agent không kèm model.
- Mỗi model giữ một mức effort duy nhất (opus `high`, sonnet `medium`, haiku `low`), đúng luật "one model keeps one effort".
- Máy không có `claude` thì giữ hành vi cũ.

### 2. Ghép mặc định theo từng role (`loadTeam`)
- Role nào đã lưu trong `team.json` thì dùng bản lưu, role nào chưa có thì dùng mặc định.
- `routing.defaults` liệt kê các role đang dùng mặc định. Trường này thay cho cờ `generated: true`.
- **Tự khớp effort:** nếu một role đã lưu dùng `claude:claude-sonnet-5-5@high`, các role mặc định có sonnet chuyển theo `@high`, để routing không bị lỗi xung đột effort.

### 3. Tự học khi dispatch (`learnRoute`, gọi trong `dispatch`)
- **Khi nào ghi:** có `--prefer X`, không phải `--dry-run`, và worker khởi động được bằng chính X (không phải candidate fallback).
- **Ghi gì:** role thành `use: [X]`.
  - Phần `use` và `fallback` cũ dời xuống `fallback`, bỏ trùng.
  - Bỏ mục cùng `agent:model` với X để không xung đột effort.
  - Giữ `orchestrator` nếu có.
  - `escalate` giữ nguyên.
- **Kiểm tra trước khi ghi:** chạy `routingErrors` trên routing mới (đã ghép mặc định), với danh sách model của omp, opencode và pi. Nếu có lỗi thì **không ghi**: dispatch vẫn chạy, kit in lý do.
- **Chỉ ghi role đó** vào `team.json`. Các role mặc định khác không bị ghi ra file.
- Nếu X đã là `use[0]` của role thì không làm gì.
- Thông báo: `[desk] routing engineer ← X (saved to .desk/team.json)`, hoặc `[desk] routing engineer: X not saved — <lý do>`.

### 3b. Ghi lại khi người dùng nhắc (`capture` + `C route learn`)
Đây là trường hợp người dùng nói, ví dụ, "engineer dùng sonnet medium, fallback omp deepseek 4.1 flash high" hoặc "tester để haiku", dù chưa dispatch gì.

- **Hook `capture`** (`kit/method/hooks/capture.mjs`, `_lib.mjs`): thêm tín hiệu `route`. Tín hiệu bật khi cùng một prompt có:
  - **một role:** `engineer`, `designer`, `tester`, `fixer`, `writer`, `reviewer`, `researcher`, hoặc từ tiếng Việt như *kỹ sư*, *người test*, *review*, *viết*;
  - **một agent hoặc họ model:** `claude`, `omp`, `pi`, `opencode`, `codex`, `sonnet`, `opus`, `haiku`, `deepseek`, `glm`, `kimi`, `qwen`, `minimax`, `gpt`, `gemini`…
- **Lời nhắc cho lead.** Khi tín hiệu bật, hook in: `[desk] the user named an agent/model for a role → record it: C route learn <role> --use agent:provider/model@effort [--fallback …]`.
  - Hook không tự đoán model, vì regex không đọc đúng được câu như "deepseek 4.1 flash high".
  - Lead chuyển câu nói thành candidate. Nếu chưa rõ thì lead hỏi lại một câu, ví dụ "omp hay opencode?".
  - Bỏ qua slash command và worker, như các tín hiệu khác.
- **Lệnh `C route learn <role> --use a[,b] [--fallback c,d] [--escalate e]`** (`cli.mjs`, `team.mjs`):
  - **Ghi gì:** `--use` cho trước thì thay `use`; phần `use` cũ dời xuống `fallback` như mục 3. `--fallback` / `--escalate` cho trước thì thay phần tương ứng; không cho thì giữ nguyên.
  - **Kiểm tra:** chạy cùng các bước của mục 3 và 4 (routing hợp lệ, có provider, đúng danh sách model). Sai thì không ghi, và in lỗi kèm gợi ý tên đầy đủ.
  - **Candidate chưa kiểm chứng được** (ngoài danh sách model, hoặc opencode có `@effort`): chạy ping-pong (mục 4b) trước. Qua thì ghi, không qua thì không ghi, và lead báo lỗi cho người dùng, ví dụ `Variant unavailable … medium`.
  - **Ghi nguồn:** mỗi role đã lưu có `"learned": {"at": "<ISO>", "from": "user" | "dispatch"}`, để `team check` cho biết role nào do người dùng chỉ định.
  - Đây là lệnh mới duy nhất. Nó dùng chung `learnRoute` với dispatch.

### 4. Bắt buộc ghi provider
- Với omp, opencode và pi, `--prefer` khi tự học phải có dạng `agent:provider/model[@effort]`.
- Thiếu provider (ví dụ `omp:deepseek-v4.1-flash`) thì kit không lưu, và gợi ý tên đầy đủ tìm được trong danh sách model (`op-go/deepseek-v4.1-flash`).
- Claude và codex không cần provider.
- Kit kiểm tra provider có đúng với agent không, ví dụ báo lỗi `omp:opencode-go/…` vì omp gọi provider này là `op-go`.

### 4b. Ping-pong trước khi ghi candidate chưa có trong danh sách (`pingCandidate`)
Nguyên tắc: **chỉ ghi vào routing những gì đã chứng minh là chạy được.** Candidate nào kit không kiểm chứng được bằng danh sách model thì phải qua một worker test hỏi-đáp ngắn trước.

- **Khi nào phải ping:**
  - agent không có danh sách model: `claude`, `codex`;
  - model không có trong danh sách: tên mới, alias, hoặc danh sách cũ;
  - effort không kiểm tra trước được: opencode `#variant`, hoặc pi khi model có thinking;
  - danh sách lấy lỗi: ví dụ `pi: no provider logged in`, khi đó ping cho kết quả cuối cùng.

  Candidate có trong danh sách và effort hợp lệ theo danh sách (omp) thì **không cần ping**.
- **Cách ping:** gọi CLI của agent ở chế độ headless, với đúng model và effort mà Orca sẽ nhận. Prompt là `Reply with exactly: PONG`. Kit chạy trong một thư mục tạm ngoài project, để hook của project không chạy, và dừng sau 120 giây.

  | Agent | Lệnh ping |
  |---|---|
  | claude | `claude -p --model M --effort E "…"` |
  | omp | `omp -p --model provider/id:E --max-cost 0.05 "…"` |
  | pi | `pi -p --model provider/id --thinking E "…"` |
  | opencode | `opencode run --archived --model provider/id#E "…"` |
  | codex | `codex exec -m M -c model_reasoning_effort=E "…"` (chưa thử, máy chưa có codex) |

- **Kết quả:**
  - **Qua:** exit 0 và output có `PONG`.
  - **Không qua:** kit lấy dòng lỗi đầu tiên, ví dụ `provider.no-route: Variant unavailable for opencode-go/deepseek-v4.1-flash: medium`.
  - Ghi vào `.desk/.routing-cache.json` dưới `pings[<candidate>] = {ok, at, err}`, giữ 7 ngày. Trong thời gian đó không ping lại. `route learn --reping` ép ping lại.
- **Dùng ở đâu:**
  - **`route learn`:** ping từng candidate chưa kiểm chứng trong `--use`, `--fallback` và `--escalate`. Có candidate không qua thì không ghi gì, và in candidate nào lỗi, lỗi gì.
  - **`dispatch --prefer X`:** X chưa kiểm chứng thì ping trước khi khởi động worker.
    - Không qua: bỏ X, in `[SKIP] X: ping failed — …`, chạy candidate tiếp theo trong routing, và không ghi.
    - Qua: khởi động worker bằng X, rồi ghi như mục 3.
  - **`route()`:** candidate đã có ping lỗi còn trong hạn bị bỏ qua như khi khởi động thất bại.
- **Chi phí:** mỗi ping khoảng 20 nghìn token input (đo với opencode deepseek-v4.1-flash, cost 0). Ping chỉ chạy khi người dùng đã nhắc model đó, nên đó là chi phí người dùng đã chấp nhận. Lệnh in `pinging X…` để người dùng thấy.
- **Cho test:** biến môi trường `AGENTKIT_PING` trỏ tới một script giả, giống `AGENTKIT_ORCA`, để test không gọi model thật.
- **Giới hạn:** ping chạy CLI trực tiếp, không qua Orca. Nó chứng minh *model + provider + effort* chạy được, nhưng không chứng minh Orca truyền tham số đúng (xem câu hỏi 3).

### 5. Danh sách model cho pi
- Thêm `catalog: ['pi', ['--list-models']]`.
- Đọc bảng pi in ra: bỏ dòng tiêu đề, mỗi dòng thành `provider/model`. Cột thinking `yes` thì model nhận các mức `off…max`; `no` thì không nhận effort.
- Nếu pi trả `No models available`, kit ghi lỗi `pi: no provider logged in`. `route` bỏ qua candidate pi có model, và tự học từ chối lưu kèm lý do đó.

### 6. opencode có effort
- `AGENTS.opencode.effort` đổi từ `null` thành `'hash'`. `launchArgs` sinh `--model provider/model#effort`.
- Kiểm tra trước được hai thứ: model có trong `opencode models`, và mức thuộc `minimal/low/medium/high/xhigh/max`. Nếu omp có cùng model id, kit dùng danh sách thinking của omp để cảnh báo sớm, ví dụ `@medium` cho deepseek-v4.1-flash.
- Không biết trước được model có variant đó hay không, vì opencode không liệt kê variant. Vì vậy opencode có `@effort` **luôn ping trước** (mục 4b). Ping với variant sai thất bại ngay (`provider.no-route`), trước khi khởi động worker.

### 7. Hiển thị (`kit/method/hooks/cli.mjs`)
- `team check` đánh dấu từng role `(default)` hoặc `(saved)`, và báo trạng thái danh sách model của pi.
- `dispatch` in dòng thông báo của bước 3.

### 8. Hiệu năng
- `route()` chỉ lấy danh sách model của agent nào có candidate kèm model.
- Nhờ vậy fallback `omp` không kèm model sẽ không làm kit gọi `omp models` (tối đa 60 giây) trong test và trong dự án mới.

### 9. Tài liệu (`kit/method/docs/team.md`)
- Bước 1: routing mặc định là các model Claude. `team check` cho biết role nào là mặc định.
- Thêm câu: khi người dùng nhắc agent hay model cho một role, ghi ngay bằng `C route learn <role> --use agent:provider/model@effort`. Nếu đang dispatch thì dùng `--prefer`, cũng được lưu. Lần sau không cần nhắc lại.
- Ghi cách truyền effort của từng agent (bảng ở phần "Dữ kiện").
- `SKILL.md` gộp phải giữ dưới 220 dòng.

### 10. Test (`test/team.test.js`, dùng fake-orca)
- Mặc định là model Claude và qua `routingErrors`.
- Ghép theo role: lưu `engineer` thì `tester` vẫn có mặc định.
- Tự khớp effort giữa role đã lưu và role mặc định.
- `dispatch --prefer X` ghi X vào `team.json`, và lần dispatch sau không có `--prefer` vẫn chọn X.
- Không lưu khi `--dry-run`, khi khởi động thất bại, khi worker chạy bằng candidate fallback, hoặc khi X làm routing lỗi.
- Thiếu provider thì từ chối lưu và gợi ý tên đầy đủ.
- `capture`: prompt "engineer dùng sonnet medium" bật tín hiệu `route`; prompt chỉ có role hoặc chỉ có model thì không; slash command và worker thì không.
- `route learn`: ghi đúng `use`, `fallback` và `learned.from = "user"`; từ chối routing lỗi; lần dispatch sau chọn đúng model đã học.
- Ping-pong (dùng `AGENTKIT_PING` giả):
  - candidate trong danh sách thì không ping;
  - claude hoặc model ngoài danh sách thì ping;
  - ping qua thì ghi, ping lỗi thì không ghi và in lỗi;
  - cache 7 ngày, `--reping` ép ping lại;
  - `dispatch --prefer` với ping lỗi thì bỏ qua và dùng candidate tiếp theo;
  - lệnh ping của từng agent đúng tham số.
- Bảng pi với output mẫu, và trường hợp pi chưa đăng nhập provider.
- opencode: `launchArgs` sinh `#high`; `@effort` luôn ping trước.
- Sửa assert ở test `team check` hiện có. Cập nhật snapshot nếu output thay đổi (`UPDATE_SNAPSHOTS=1`).

### 11. Việc đi kèm
- Làm mới `examples/ios-demo` (`cd examples/ios-demo && node ../../bin/cli.js update`).
- Sửa `CLAUDE.md` cho đúng: "~50 tests", và nhắc `PLAN-v2.md` / `orca-orchestrator/` không còn tồn tại.
- Sau khi xong, chạy `update` ở `wallpaper` nếu muốn áp dụng ngay.

## Cần chốt trước khi làm

1. **Thời điểm lưu** cho claude, omp, pi và codex: lưu ngay khi worker khởi động được (đề xuất), hay đợi task `done` / `gate` như opencode?
2. **Bảng mặc định Claude** ở mục 1 đã ổn chưa?
3. **Chạy một worker Orca thật** bằng opencode `#high`, để kiểm tra Orca có truyền nguyên `#variant` cho opencode không? Việc này tốn một ít token và cần bạn đồng ý.

## Rủi ro

- **Model ID của Claude được viết cố định** (`claude-*-5-5`). Khi có model mới thì phải sửa kit. Có thể dùng alias `opus` / `sonnet` / `haiku` nếu Orca chấp nhận, việc này cần thử.
- **opencode không có danh sách variant.** Ping-pong (mục 4b) bắt lỗi này trước khi ghi và trước khi khởi động worker.
- **Ping tốn token và thời gian**, tối đa 120 giây mỗi candidate. Cache 7 ngày giữ chi phí này ở mức thấp. Ping lỗi vì mạng hoặc hết hạn mức có thể chặn một lựa chọn đúng: lead báo lỗi cho người dùng, và người dùng có thể ép ping lại bằng `--reping`.
- **Ghép theo role thay đổi hành vi cũ.** Trước đây, project tự khai báo một vài role thì các role còn lại báo lỗi `no routing`. Giờ các role đó sẽ dùng mặc định Claude.
