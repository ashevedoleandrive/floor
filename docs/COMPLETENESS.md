# Completeness audit

Every object a user can act on, every operation that should exist, and what is
actually there. Written after this critique:

> "literally think of everything... i dont want to encounter situations like the
> disable making rows dissapear. or not know how to add accounts, or remove them
> or edit stuff or drill down in stuff or navigate easily"

The disable bug is the template for the whole class: an action that removed its
own reversal from the interface. It was reversible in the database and
irreversible in the product, which is the only definition that matters.

**Two rules the rebuild has to hold.**

1. Every destructive action keeps its undo visible.
2. No object is reachable for creation but unreachable for edit or removal. If
   you can make it, you can fix it and you can delete it.

Status: **present** works today · **missing** does not exist · **partial**
exists but incomplete or only through the API.

---

## Accounts

The core object. 38 of them, and the only way to change one today is SQL.

| Operation | Status | Notes |
|---|---|---|
| Create, one at a time | partial | Only by running an assessment on a new domain. There is no "add this account without assessing it yet". |
| Create, bulk | present | Paste box takes bare domains or CSV. |
| Read, list | present | The queue. |
| Read, detail | present | Account page. |
| **Update** | **missing** | A wrong region, a wrong last-touched date or a wrong name cannot be corrected anywhere in the product. Region drives 15% of the score. |
| **Delete** | **missing** | A typo'd domain is permanent. |
| **Bulk select** | **missing** | No way to act on several rows at once. |
| **Bulk assess** | **missing** | Batch runs only from a terminal script, which the operator does not have. |
| Set last-touched | partial | Only at assess time. Cannot be edited afterwards, so cool-down cannot be corrected. |
| Assign owner | missing | The field exists in the schema and is displayed. Nothing can set it. |

**The sharpest gap:** cool-down is one of the three scoring dimensions and its
input, `last_touched_at`, is uneditable. An account suppressed on a wrong date
stays wrongly suppressed.

---

## Assessments

| Operation | Status | Notes |
|---|---|---|
| Create | present | Run assessment, single account. |
| Read | present | Account page, with evidence and per-stage trace. |
| **Re-run** | **missing** | No way to say "this one is stale, do it again". Re-assessing requires typing the domain into the run box, which is not discoverable as a refresh. |
| **Delete** | **missing** | A bad assessment is permanent and keeps scoring the account. |
| Read history | missing | Every run is stored, only the latest is ever shown. The trend is invisible. |
| Cancel in flight | missing | A run started by mistake costs money and cannot be stopped. |

---

## Jobs

| Operation | Status | Notes |
|---|---|---|
| Create | present | Via assess. |
| Read status | present | Polled during a run. |
| **Read history** | **missing** | No list of past runs, so the two orphaned jobs from the streaming bug are invisible in the product. |
| **Retry a failed job** | **missing** | An errored job is a dead end. |
| Cancel | missing | See above. |

---

## Gold set

| Operation | Status | Notes |
|---|---|---|
| Read | present | Accuracy page. |
| Verify a figure | present | Dialog, and the only real editing flow in the product. |
| **Un-verify or correct** | **missing** | A mistyped figure is permanent and silently corrupts every future accuracy claim. **This is the most dangerous gap in the tool**, because the accuracy number is the trust argument. |
| **Add a candidate** | **missing** | The 22 candidates were seeded. No way to add a merchant. |
| Delete a candidate | missing | |

---

## Source classification rules

The most complete object, because it was rebuilt after the disable bug.

| Operation | Status | Notes |
|---|---|---|
| Create | present | With a duplicate-pattern guard. |
| Read, with usage | present | Shows how many claims each rule matched. |
| **Update** | **partial** | The API accepts an edit. The interface has no edit affordance, so a rule can only be deleted and recreated. |
| Enable and disable | present | Fixed. Stays listed when disabled. |
| Delete | present | Refuses to delete built-ins, correctly. |
| **Reorder** | **missing** | Order decides which rule wins, and it can only be set at creation. |

---

## Backlog

| Operation | Status | Notes |
|---|---|---|
| Create | present | Dialog. |
| Read | present | Zones by area. |
| **Update** | **missing** | A card cannot move from idea to building to live, which is the entire point of a backlog. |
| **Delete** | **missing** | |
| Reorder | missing | |

---

## Settings

| Operation | Status | Notes |
|---|---|---|
| Read and update | present | Settings screen, nine settings, each stating its effect. |
| **Reset to default** | **missing** | No way back from a bad value except knowing the original. |
| Change history | missing | Who changed the floor, and when, is unrecorded. |

---

## Navigation and orientation

| Concern | Status | Notes |
|---|---|---|
| Get to any page | present | Nav, seven items. |
| **Know where you are** | partial | Nav marks the active page. Account pages show a breadcrumb, other deep states do not. |
| **Link to a specific state** | **missing** | A filtered queue, an expanded row, a selected region cannot be linked or bookmarked. Reloading loses your place. |
| **Return from a detail view** | partial | One back link on account pages. |
| **Search across accounts** | partial | The queue filter searches the loaded page only. |
| Keyboard navigation | missing | No shortcuts, no focus management in dialogs. |
| **Undo anything** | **missing** | Nothing in the product can be undone. Every destructive action is immediate and final. |

---

## Priority for the rebuild

**Must exist before this is defensible as a tool:**

1. Edit and delete an account, including last-touched, which feeds scoring.
2. Correct or un-verify a gold-set figure. It silently poisons the accuracy claim.
3. Re-run and delete an assessment.
4. Move a backlog card between statuses.
5. Edit and reorder a classification rule.
6. Undo, or at minimum confirm, on every destructive action.

**Should exist:**

7. Bulk select and bulk assess from the queue, so batching does not need a terminal.
8. Job history, so failures are visible in the product rather than in the database.
9. Deep-linkable state, so a filtered view can be shared or reloaded.
10. Reset a setting to its default.

**Worth having:**

11. Assessment history per account, showing how an estimate moved.
12. Keyboard navigation and proper focus handling in dialogs.
13. A settings change log.

---

## The rule this audit exists to enforce

An action is only reversible if it is reversible **in the interface**. The
disable bug was reversible in the database the entire time, and that was worth
nothing to the person clicking it.
