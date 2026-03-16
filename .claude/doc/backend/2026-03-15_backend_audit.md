# Backend Code Audit Report
**Date**: 2026-03-15
**Scope**: `wippestoolen/app/api/v1/endpoints/`, `wippestoolen/app/services/`, `wippestoolen/app/schemas/`, `wippestoolen/app/models/`
**Triggered by**: Bug in `/tools/my-tools` — missing `description` column in `get_user_tools` SQL query, silently swallowed by generic `except Exception`.

---

## Summary Table

| ID | File | Lines | Severity | Category | Title |
|----|------|-------|----------|----------|-------|
| A1 | `tool_service.py` | 604–611 | CRITICAL | SQL/Schema mismatch | `get_tools_by_category` missing `description` column |
| A2 | `tool_service.py` | 181–182, 581–582 | HIGH | SQL Injection | Unvalidated `sort_by` / `sort_order` interpolated into raw SQL |
| A3 | `tool_service.py` | 434–453 | HIGH | SQL Injection | Dynamic UPDATE built from `update_data.model_dump()` field names |
| A4 | `tool_service.py` | 212–214 | HIGH | Division by zero | `math.ceil(total / page_size)` crashes when `total == 0` |
| A5 | `tool_service.py` | 125–166 | MEDIUM | Missing field | `get_tool_by_id` does not populate `photos` on the returned `Tool` object |
| A6 | `tools.py` (endpoint) | 125–129 | HIGH | Silent exception | Generic `except Exception` hides all non-category errors in `create_tool` |
| A7 | `tools.py` (endpoint) | 173–177 | HIGH | Silent exception | Generic `except Exception` hides all errors in `browse_tools` |
| A8 | `tools.py` (endpoint) | 501–505 | HIGH | Silent exception | Generic `except Exception` hides all errors in `update_tool` |
| A9 | `tools.py` (endpoint) | 541–545 | HIGH | Silent exception | Generic `except Exception` hides all errors in `delete_tool` |
| A10 | `tools.py` (endpoint) | 84, 455 | MEDIUM | Hardcoded placeholder | Category always returned as `{"name": "Unknown", "slug": "unknown"}` after create/update |
| A11 | `bookings.py` (endpoint) | 67–77 | HIGH | Missing error handling | `HTTPException` from `_get_tool_with_owner` not caught — leaks 404 but loses context |
| A12 | `bookings.py` (endpoint) | 194–200 | MEDIUM | Missing auth | `/bookings/tools/{tool_id}/availability` requires auth but tool availability should be public |
| A13 | `booking_service.py` | 83–89 | HIGH | Race condition | Availability check and booking insert are not atomic — TOCTOU window |
| A14 | `booking_service.py` | 84 | HIGH | AttributeError risk | `booking.tool.owner_id` accessed without confirming `tool` relationship is loaded |
| A15 | `booking_service.py` | 330–336 | MEDIUM | Incorrect ORM join | `both` role filter uses implicit cross-join `Tool` instead of joined subquery |
| A16 | `booking_service.py` | 554–565 | MEDIUM | Decimal / float mismatch | `daily_rate * num_days` (Decimal) assigned to `BookingCostCalculation` field typed `Decimal` — works, but `deposit_percentage = Decimal('0.50')` multiplication is fragile |
| A17 | `review_service.py` | 648–654 | MEDIUM | Type mismatch | `_update_user_rating` passes `float(avg_rating)` to a `Numeric(3,2)` column that expects `Decimal` |
| A18 | `review_service.py` | 679–685 | MEDIUM | Type mismatch | `_update_tool_rating` same issue as A17 |
| A19 | `review_service.py` | 185 | MEDIUM | AttributeError risk | `review.booking.tool_id` accessed without verifying `booking.tool` is loaded |
| A20 | `review_service.py` | 465–466 | HIGH | N+1 query | `get_tool_reviews` executes full scan twice (all reviews then recent reviews) on same query |
| A21 | `reviews.py` (endpoint) | 118 | MEDIUM | Private method in endpoint | Endpoint calls `review_service._get_review_with_relations()` directly — breaks encapsulation |
| A22 | `reviews.py` (endpoint) | 530–541 | HIGH | Silent exception | `delete_review` swallows all exceptions in generic `except Exception` with no logging |
| A23 | `reviews.py` (endpoint) | 536 | HIGH | State after delete | `_update_user_rating` called after `db.delete(review)` but before commit — if commit fails, rating is not rolled back consistently |
| A24 | `reviews.py` (endpoint) | 458–483 | CRITICAL | Missing auth | `/reviews/statistics` exposes platform-wide stats with no admin check |
| A25 | `notifications.py` (endpoint) | 363–398 | CRITICAL | Missing auth | `/notifications/admin/broadcast` has admin check commented out — any authenticated user can broadcast |
| A26 | `notifications.py` (endpoint) | 440–442 | MEDIUM | Silent exception | WebSocket token validation catches all exceptions silently with bare `except Exception` |
| A27 | `notifications.py` (endpoint) | 475–479 | MEDIUM | Silent exception | Outer WebSocket handler catches all exceptions with bare `except Exception` |
| A28 | `notification_service.py` | 152–153 | MEDIUM | Returning None from non-Optional | `create_notification` returns `None` when preferences skip the notification, but return type is `NotificationResponse` |
| A29 | `notification_service.py` | 530 | MEDIUM | Silent exception | `broadcast_notification` catches `except Exception` per user with no logging |
| A30 | `tool_service.py` | 538–554 | MEDIUM | SQL Injection | `get_categories_with_counts` uses f-string interpolation for `active_filter` |
| A31 | `reviews.py` (schema) | 143–149 | LOW | Datetime type mismatch | `BookingBasicInfo.requested_start_date` / `requested_end_date` typed `datetime` but DB model uses `date` |
| A32 | `booking_service.py` | 418–419 | LOW | Missing check status | `check_tool_availability` does not check if the tool itself is `is_available = true` |
| A33 | `admin.py` | 11–56 | HIGH | Missing auth | `/admin/create-tool-photos-table` has no authentication or admin check at all |
| A34 | `tool_service.py` | 328 | MEDIUM | Division by zero | `get_user_tools` same `math.ceil(total / page_size)` issue when tool count is 0 |
| A35 | `tool_service.py` | 597 | MEDIUM | Division by zero | `get_tools_by_category` same `math.ceil(total / page_size)` issue |

---

## Detailed Findings

---

### A1 — CRITICAL | SQL/Schema mismatch: `get_tools_by_category` missing `description`

**File**: `wippestoolen/app/services/tool_service.py`
**Lines**: 604–669

**Description**: The SQL query for `get_tools_by_category` selects these columns in order:
```
t.id [0], t.title [1], t.condition [2], t.is_available [3], t.daily_rate [4],
t.pickup_city [5], t.pickup_postal_code [6], t.delivery_available [7],
t.average_rating [8], t.total_ratings [9], ...
```
The `description` column is absent. However, the row mapping at line 632 constructs `"description": row[2]`, which means it will actually set `description` to the value of `t.condition` (a string like `"good"`), and `condition` is then read from `row[2]` again — both fields receive the `condition` value. Since `ToolListResponse.description` is a required `str` field, the response will appear valid but contain incorrect data (`description` = `"good"`, `condition` = `"good"`).

**Root cause**: Same as the `/tools/my-tools` bug that triggered this audit. The SELECT column list for this method never included `t.description`.

**Fix**:
```python
# In get_tools_by_category SQL, change:
SELECT t.id, t.title, t.condition, t.is_available, t.daily_rate, ...

# To:
SELECT t.id, t.title, t.description, t.condition, t.is_available, t.daily_rate, ...
```
Then adjust all row index references in the mapping block by +1 for indices 2 and above (condition becomes `row[3]`, is_available `row[4]`, etc.).

---

### A2 — HIGH | SQL Injection: unvalidated `sort_by` / `sort_order` in raw SQL

**File**: `wippestoolen/app/services/tool_service.py`
**Lines**: 181–182 (`browse_tools`), 581–582 (`get_tools_by_category`)

**Description**: Both methods build an `ORDER BY` clause by direct f-string interpolation:
```python
order_clause = f"t.{sort_by} {sort_order.upper()}"
```
Although the endpoint layer validates `sort_by` via FastAPI's `regex` parameter, this service method accepts any string directly. If called internally (e.g., from a future internal API or test harness) with unsanitized input, this is exploitable SQL injection.

Additionally, the `sort_by` regex in the endpoint (`"^(created_at|daily_rate|rating|title)$"`) allows `rating`, but the SQL column is `average_rating`, so `ORDER BY t.rating` would cause a PostgreSQL error that is then silently swallowed.

**Fix**:
```python
ALLOWED_SORT_COLUMNS = {"created_at", "daily_rate", "average_rating", "title"}
ALLOWED_SORT_ORDERS = {"asc", "desc"}

if sort_by not in ALLOWED_SORT_COLUMNS:
    sort_by = "created_at"
if sort_order.lower() not in ALLOWED_SORT_ORDERS:
    sort_order = "desc"

order_clause = f"t.{sort_by} {sort_order.upper()}"
```
Alternatively, use SQLAlchemy ORM constructs to eliminate the interpolation entirely.

---

### A3 — HIGH | SQL Injection: dynamic UPDATE via `model_dump()` field names

**File**: `wippestoolen/app/services/tool_service.py`
**Lines**: 434–453

**Description**: The `update_tool` method iterates over `update_data.model_dump(exclude_unset=True)` and builds an UPDATE query by interpolating field names directly:
```python
for field, value in update_dict.items():
    update_fields.append(f"{field} = :{field}")
    params[field] = value
```
The field names come from a Pydantic model, so under normal conditions they are safe. However, if an attacker somehow controlled the deserialization of `ToolUpdateRequest` (e.g., via a crafted JSON payload that Pydantic passes through if extra fields are allowed), arbitrary column names could be injected into the SET clause. More concretely, Pydantic v2 by default forbids extra fields, but this should be made explicit. Additionally, `model_dump()` field names are not validated against an allowlist of actual DB columns before interpolation.

**Fix**: Add an explicit allowlist:
```python
ALLOWED_UPDATE_FIELDS = {
    "title", "description", "category_id", "brand", "model", "condition",
    "is_available", "max_loan_days", "deposit_amount", "daily_rate",
    "pickup_address", "pickup_city", "pickup_postal_code", "pickup_latitude",
    "pickup_longitude", "delivery_available", "delivery_radius_km",
    "usage_instructions", "safety_notes"
}

for field, value in update_dict.items():
    if field not in ALLOWED_UPDATE_FIELDS:
        continue
    update_fields.append(f"{field} = :{field}")
    params[field] = value
```

---

### A4 / A34 / A35 — HIGH | Division by zero in pagination

**File**: `wippestoolen/app/services/tool_service.py`
**Lines**: 212–214 (`browse_tools`), 328 (`get_user_tools`), 597 (`get_tools_by_category`)

**Description**: All three methods call `math.ceil(total / page_size)` without checking if `total` is zero. When `total == 0`, `0 / page_size` is `0.0` and `math.ceil(0.0)` returns `0`, so this does NOT actually crash. However, the next line often computes `has_next = page < total_pages` which with `total_pages = 0` and `page = 1` would give `1 < 0 = False` — correct. This is not a runtime crash but is semantically odd.

**Actual risk**: Medium — not a crash but can be confusing. A cleaner pattern is:
```python
total_pages = math.ceil(total / page_size) if total > 0 else 0
```

---

### A5 — MEDIUM | `get_tool_by_id` does not populate `photos` on returned object

**File**: `wippestoolen/app/services/tool_service.py`
**Lines**: 92–166

**Description**: The `get_tool_by_id` method fetches photo data in the SQL query (aliased as `photos` via `COALESCE(tp.photo_data, '[]'::json)`), but the manually constructed `Tool(...)` object at lines 133–164 never sets the `photos` attribute. The returned `Tool` instance will have `photos` as an unloaded relationship, not as the JSON data retrieved.

The caller in `tools.py` (endpoint `get_tool_details`, lines 321–325) then calls `photo_service.get_photos_for_tool(tool.id)` as a separate query to compensate — but this creates an N+1 pattern: first fetching the tool (which already joined photos), then fetching photos again separately.

**Fix**: Remove the photo JOIN from `get_tool_by_id` (it is unused), and rely solely on `photo_service.get_photos_for_tool`. Or, use the ORM with `selectinload(Tool.photos)`.

---

### A6 / A7 / A8 / A9 — HIGH | Silent exception swallowing in tool endpoints

**File**: `wippestoolen/app/api/v1/endpoints/tools.py`

| Handler | Lines | Detail |
|---------|-------|--------|
| `create_tool` | 125–129 | Catches all exceptions, returns "Tool creation failed" |
| `browse_tools` | 173–177 | Catches all exceptions, returns "Failed to retrieve tools" |
| `update_tool` | 501–505 | Catches all exceptions, returns "Tool update failed" |
| `delete_tool` | 541–545 | Catches all exceptions, returns "Tool deletion failed" |

**Description**: These `except Exception as e` blocks discard the original error completely. The reported bug (`description` missing in the SQL query) was silently swallowed here, producing a `500` with no diagnostic information in logs.

Note: `get_my_tools` (lines 212–216) does at least include `str(e)` in the detail, but still does not log the error.

**Fix**: At minimum, log the actual exception before returning the generic 500:
```python
import logging
logger = logging.getLogger(__name__)

except Exception as e:
    logger.exception("Tool creation failed for user %s", current_user.id)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Tool creation failed"
    )
```
Do not expose `str(e)` in production API responses as it may leak internal details.

---

### A10 — MEDIUM | Hardcoded placeholder category in `create_tool` and `update_tool` responses

**File**: `wippestoolen/app/api/v1/endpoints/tools.py`
**Lines**: 84 (`create_tool`), 455 (`update_tool`)

**Description**: Both handlers return `ToolResponse` with a hardcoded dummy category:
```python
category={"id": tool.category_id, "name": "Unknown", "slug": "unknown", "description": None, "icon_name": None}
```
The client will always see `"name": "Unknown"` for the category after creating or updating a tool, even though the category was just validated. The `get_tool_details` endpoint correctly fetches the category via `get_category_by_id`.

**Fix**: Call `tool_service.get_category_by_id(tool.category_id)` and populate the response properly, same as `get_tool_details`.

---

### A11 — HIGH | `create_booking` does not catch `HTTPException` from service layer

**File**: `wippestoolen/app/api/v1/endpoints/bookings.py`
**Lines**: 57–77

**Description**: `booking_service.create_booking_request` calls `_get_tool_with_owner`, which raises an `HTTPException` (404) directly if the tool is not found. The endpoint only catches `BookingConflictError` and `ToolUnavailableError`. An `HTTPException` raised inside the service will propagate up correctly through FastAPI, so this does not break functionality — but it is an architectural issue: services should not raise `HTTPException` (that is the endpoint's responsibility), or the endpoint must explicitly re-raise them.

More critically, the `HTTPException` from `_get_tool_with_owner` bypasses the booking-specific error handling, so a "Tool not found" situation presents a different response shape than a `BookingConflictError`. Any future catch-all `except Exception` added to this endpoint would intercept the `HTTPException` and swallow it.

**Fix**: `_get_tool_with_owner` should raise a domain-specific `ToolUnavailableError` or `ToolNotFoundError`. The endpoint converts it to HTTP 404.

---

### A12 — MEDIUM | `/bookings/tools/{tool_id}/availability` unnecessarily requires auth

**File**: `wippestoolen/app/api/v1/endpoints/bookings.py`
**Lines**: 194–240

**Description**: Checking tool availability before making a booking request is a natural unauthenticated action (e.g., browsing tools on the homepage). Requiring a JWT token here creates unnecessary friction and means the mobile app cannot pre-populate the calendar without a logged-in user.

**Fix**: Remove `current_user: User = Depends(get_current_active_user)` from this endpoint, or provide an equivalent public endpoint.

---

### A13 — HIGH | Race condition (TOCTOU) in booking creation

**File**: `wippestoolen/app/services/booking_service.py`
**Lines**: 113–159

**Description**: The booking flow is:
1. Check availability (line 114–118)
2. Create `Booking` object (line 132–145)
3. `db.flush()` (line 148)
4. Commit (line 159)

Between step 1 and step 4, another concurrent request can pass the same availability check and both bookings are committed for the same dates. There is no database-level lock or serializable isolation applied.

**Fix**: Use a database advisory lock or a `SELECT ... FOR UPDATE` on conflicting bookings before inserting:
```sql
SELECT id FROM bookings
WHERE tool_id = :tool_id
  AND status IN ('confirmed', 'active', 'returned')
  AND requested_start_date <= :end_date
  AND requested_end_date >= :start_date
FOR UPDATE
```
This locks the conflicting rows during the transaction. Alternatively, add a unique partial index or constraint at the DB level for non-cancellable overlapping bookings.

---

### A14 — HIGH | Unguarded `booking.tool.owner_id` access in `BookingStatusMachine`

**File**: `wippestoolen/app/services/booking_service.py`
**Lines**: 83–89

**Description**: `validate_transition_permission` accesses `booking.tool.owner_id` without asserting the `tool` relationship is loaded. If called with a `Booking` object where `tool` is not eagerly loaded (e.g., in a lazy-load context with an async session), this will raise `MissingGreenlet` or `DetachedInstanceError`.

In practice `_get_booking_with_relations` always loads `tool`, but this is an implicit assumption. If the method is ever called from a different code path it will fail silently and produce a confusing error.

**Fix**: Add a guard:
```python
if booking.tool is None:
    return False
```

---

### A15 — MEDIUM | Incorrect ORM join for "both roles" booking filter

**File**: `wippestoolen/app/services/booking_service.py`
**Lines**: 330–336

**Description**: The "both roles" branch of `get_user_bookings` uses:
```python
query = query.where(
    or_(
        Booking.borrower_id == user_id,
        and_(Booking.tool_id == Tool.id, Tool.owner_id == user_id)
    )
)
```
`Tool` is imported but there is no `JOIN` clause in this query path. SQLAlchemy will perform an implicit cross-join (`FROM bookings, tools WHERE ...`), which generates a Cartesian product and is both incorrect and extremely slow on large datasets. The `borrower` role branch correctly uses `.join(Tool)`, but the "both" branch does not.

**Fix**:
```python
query = query.join(Tool, Booking.tool_id == Tool.id).where(
    or_(
        Booking.borrower_id == user_id,
        Tool.owner_id == user_id
    )
)
```

---

### A16 — MEDIUM | Deposit calculation uses hardcoded 50% — no tool-specific deposit

**File**: `wippestoolen/app/services/booking_service.py`
**Lines**: 557–559

**Description**: The deposit is always calculated as 50% of the base cost:
```python
deposit_percentage = Decimal('0.50')
deposit_amount = base_cost * deposit_percentage
```
The `Tool` model has a `deposit_amount` field that owners can set. The booking request correctly sends the tool's `deposit_amount` to the `Booking` record (line 140), but `calculate_booking_cost` ignores `tool.deposit_amount` and recalculates it. These two deposit values will disagree whenever `tool.deposit_amount != 0.5 * daily_rate * num_days`.

**Fix**: Use `tool.deposit_amount` directly:
```python
deposit_amount = tool.deposit_amount or Decimal('0.00')
```

---

### A17 / A18 — MEDIUM | `float()` conversion when updating rating columns

**File**: `wippestoolen/app/services/review_service.py`
**Lines**: 648–654 (`_update_user_rating`), 679–685 (`_update_tool_rating`)

**Description**: Both methods convert the SQLAlchemy `Decimal` average to a Python `float` before passing it to the raw SQL update:
```python
"avg_rating": float(avg_rating),
```
The corresponding DB columns are `Numeric(3, 2)` (3 total digits, 2 decimal places). Python `float` values passed to PostgreSQL via asyncpg can have floating point representation issues (e.g., `4.333333333333333` instead of `4.33`) which may fail the `Numeric(3, 2)` constraint or produce unexpected rounding.

**Fix**: Pass the `Decimal` directly, or round it explicitly:
```python
"avg_rating": round(avg_rating, 2),  # still Decimal
```

---

### A19 — MEDIUM | `review.booking.tool_id` accessed without confirming `tool` is loaded

**File**: `wippestoolen/app/services/review_service.py`
**Line**: 185

**Description**: In `update_review`, after the update:
```python
if review.review_type == ReviewType.BORROWER_TO_OWNER.value:
    await self._update_tool_rating(review.booking.tool_id)
```
`review.booking` and `review.booking.tool` are loaded by `_get_review_with_relations` via `selectinload(Review.booking).selectinload(Booking.tool)`. However, the `_get_review_with_relations` called at line 152 does load the booking but NOT the tool within the booking — looking at line 595, the selectinload chain ends at `Booking.tool`, which loads the Tool object but `tool_id` is a column on `Booking`, not requiring the tool relationship. So `review.booking.tool_id` is safe (it is a column, not a relationship). However, the code should use `review.booking.tool_id` consistently and not `review.booking.tool.id` in other places without a loaded `tool`.

---

### A20 — HIGH | N+1 / double-query in `get_tool_reviews`

**File**: `wippestoolen/app/services/review_service.py`
**Lines**: 465–488

**Description**: The method first fetches all reviews for statistics:
```python
all_reviews_result = await self.db.execute(query)
all_reviews = all_reviews_result.scalars().all()
```
Then immediately runs the same query again for pagination:
```python
recent_query = query.order_by(desc(Review.created_at)).limit(filters.size)
recent_result = await self.db.execute(recent_query)
recent_reviews = recent_result.scalars().all()
```
This executes the same base query twice. For tools with many reviews, this doubles DB load. The statistics (average, distribution) are computed in Python by loading all records into memory, which will not scale.

**Fix**: Use SQL aggregate functions for statistics:
```sql
SELECT AVG(rating), COUNT(*), AVG(tool_condition_rating) FROM reviews WHERE ...
```
Then run a single paginated query for the recent reviews. Do not load all reviews into memory.

---

### A21 — MEDIUM | Endpoint calls private service method directly

**File**: `wippestoolen/app/api/v1/endpoints/reviews.py`
**Lines**: 118, 505

**Description**: The `get_review` and `delete_review` endpoints call `review_service._get_review_with_relations()` directly. Methods prefixed with `_` are private by convention. This creates tight coupling and means the internal representation leaks into the endpoint layer. If `_get_review_with_relations` changes its loading strategy, endpoints break.

**Fix**: Add a public `get_review_by_id(review_id)` method to `ReviewService`.

---

### A22 — HIGH | Silent exception swallowing in `delete_review`

**File**: `wippestoolen/app/api/v1/endpoints/reviews.py`
**Lines**: 528–541

**Description**:
```python
except Exception as e:
    await db.rollback()
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to delete review"
    )
```
The actual exception `e` is captured but never logged, making it impossible to diagnose failures. The rollback is correct, but the error is lost.

**Fix**: Add `logger.exception("Failed to delete review %s", review_id)` before the raise.

---

### A23 — HIGH | Rating update after delete may be inconsistent

**File**: `wippestoolen/app/api/v1/endpoints/reviews.py`
**Lines**: 530–541

**Description**: The sequence is:
1. `await db.delete(review)` — marks the object for deletion in the session
2. `await db.commit()` — commits the delete
3. `await review_service._update_user_rating(review.reviewee_id)` — updates user rating
4. `await review_service._update_tool_rating(review.booking.tool_id)` — updates tool rating

Steps 3 and 4 are run after the commit in step 2. If step 3 or 4 fails (e.g., DB connection error), the review is gone but the denormalized ratings are not updated, leaving the user/tool with a stale average rating permanently. There is no transaction wrapping all four steps.

**Fix**: Move the rating updates inside the same transaction as the delete:
```python
await db.delete(review)
# do rating updates here before commit
await review_service._update_user_rating(review.reviewee_id)
if review.review_type == "borrower_to_owner":
    await review_service._update_tool_rating(review.booking.tool_id)
await db.commit()
```

---

### A24 — CRITICAL | `/reviews/statistics` exposes platform data with no admin check

**File**: `wippestoolen/app/api/v1/endpoints/reviews.py`
**Lines**: 458–483

**Description**: The `get_review_statistics` endpoint returns platform-wide data including total review counts, flagged review counts, and pending moderation counts. This is admin-level data but is accessible by any authenticated user. The only gate is `Depends(get_current_active_user)`.

**Fix**: Add an admin role check:
```python
if not current_user.is_admin:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
```
Or move this endpoint to a dedicated `/admin/` router with an admin dependency.

---

### A25 — CRITICAL | `/notifications/admin/broadcast` has admin check commented out

**File**: `wippestoolen/app/api/v1/endpoints/notifications.py`
**Lines**: 363–398

**Description**: The broadcast endpoint has an explicit TODO comment acknowledging the missing check:
```python
# TODO: Add admin permission check
# if not current_user.is_admin:
#     raise HTTPException(...)
```
Any authenticated user can currently send notifications to all users on the platform.

**Fix**: Uncomment and implement the admin check immediately. This is a CRITICAL vulnerability as it allows authenticated users to spam all platform users.

---

### A26 / A27 — MEDIUM | Silent exception swallowing in WebSocket handler

**File**: `wippestoolen/app/api/v1/endpoints/notifications.py`
**Lines**: 440–442, 475–479

**Description**: Two levels of bare `except Exception` in the WebSocket handler:

Inner (lines 440–442):
```python
except Exception:
    await websocket.close(code=4001, reason="Invalid token")
    return
```

Outer (lines 475–479):
```python
except Exception as e:
    try:
        await websocket.close(code=4000, reason="Server error")
    except:
        pass
```

The outer `except:` (no type, line 477) is a bare `except` that catches `BaseException` including `KeyboardInterrupt` and `SystemExit`. The inner block loses the original exception entirely.

**Fix**: Log both exceptions. The outer bare `except:` should be `except Exception:` at minimum.

---

### A28 — MEDIUM | `create_notification` returns `None` but is typed `NotificationResponse`

**File**: `wippestoolen/app/services/notification_service.py`
**Lines**: 152–153

**Description**:
```python
if not self._should_send_notification(notification_data.type, notification_data.channels, preferences):
    return None  # Skip notification based on preferences
```
The method signature is `async def create_notification(...) -> NotificationResponse`. Returning `None` violates the return type and will cause `AttributeError` or a Pydantic validation error in callers that use the return value without checking for `None`.

The caller `create_notification_from_event` (line 200) returns the result directly as `Optional[NotificationResponse]`, which is consistent, but the signature of `create_notification` itself is incorrect and misleading.

**Fix**: Change the return type to `Optional[NotificationResponse]` and update all callers to handle `None`.

---

### A29 — MEDIUM | Silent failure per user in `broadcast_notification`

**File**: `wippestoolen/app/services/notification_service.py`
**Line**: 530

**Description**: The per-user notification creation is wrapped in:
```python
except Exception:
    failed_count += 1
```
Errors are silently incremented into a counter with no logging. If a systematic failure occurs (e.g., DB schema mismatch), all notifications will silently fail and the caller will see only `failed_count > 0` with no diagnostic information.

**Fix**: Log the exception at WARNING level:
```python
except Exception as exc:
    logger.warning("Failed to create broadcast notification for user %s: %s", user_id, exc)
    failed_count += 1
```

---

### A30 — MEDIUM | SQL Injection in `get_categories_with_counts` via f-string

**File**: `wippestoolen/app/services/tool_service.py`
**Lines**: 538–554

**Description**: The `active_filter` string is built conditionally and interpolated into the SQL:
```python
active_filter = "AND tc.is_active = true" if active_only else ""
result = await self.db.execute(
    text(f"""
        ...
        WHERE 1=1 {active_filter}
        ...
    """)
)
```
`active_filter` is a hardcoded string constructed from a boolean parameter, so the actual SQL injection risk here is minimal. However, the pattern is dangerous and sets a bad precedent. If `active_filter` construction is ever made more complex (e.g., accepting a user-supplied filter value), it becomes a real injection vector.

**Fix**: Use a bound parameter:
```python
where_clause = "WHERE tc.is_active = :active_only" if active_only else "WHERE 1=1"
result = await self.db.execute(
    text(f"SELECT ... FROM tool_categories tc ... {where_clause} ..."),
    {"active_only": True} if active_only else {}
)
```
Or use SQLAlchemy ORM expressions to avoid raw SQL entirely.

---

### A31 — LOW | `BookingBasicInfo` in review schema uses `datetime` for date fields

**File**: `wippestoolen/app/schemas/review.py`
**Lines**: 143–149

**Description**:
```python
class BookingBasicInfo(BaseModel):
    id: UUID
    requested_start_date: datetime
    requested_end_date: datetime
```
The `Booking` model defines `requested_start_date` and `requested_end_date` as `Date` columns (not `DateTime`). Pydantic will coerce `date` to `datetime` (midnight UTC), so this does not cause a runtime error, but the schema is semantically incorrect and will serialize dates with a `T00:00:00` timestamp suffix, which may confuse frontend consumers.

**Fix**: Change to `date`:
```python
from datetime import date
requested_start_date: date
requested_end_date: date
```

---

### A32 — LOW | Availability check does not verify `tool.is_available`

**File**: `wippestoolen/app/services/booking_service.py`
**Lines**: 415–432

**Description**: `check_tool_availability` only checks for conflicting active bookings. It does not verify that `Tool.is_available == True` or `Tool.is_active == True`. A tool that the owner has manually set to unavailable will still pass the availability check.

The booking creation flow does call `_get_tool_with_owner` which fetches the tool, but neither `create_booking_request` nor `check_tool_availability` checks `tool.is_available`.

**Fix**: Add a check in `check_tool_availability` or in `create_booking_request`:
```python
if not tool.is_available or not tool.is_active:
    raise ToolUnavailableError("Tool is not currently available for booking")
```

---

### A33 — HIGH | `/admin/create-tool-photos-table` has no authentication

**File**: `wippestoolen/app/api/v1/endpoints/admin.py`
**Lines**: 11–56

**Description**: This endpoint accepts unauthenticated POST requests and executes DDL (`CREATE TABLE`, `CREATE INDEX`) directly on the production database. Any external actor that discovers this route can invoke arbitrary database schema manipulation.

While this is described as a "temporary endpoint", it is currently deployed and carries no auth requirement.

**Fix**: Either remove this endpoint entirely (migrations should handle schema changes), or at minimum add authentication and an admin role check:
```python
@router.post("/create-tool-photos-table", ...)
async def create_tool_photos_table(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    ...
```

---

## Summary by Category

### SQL/Schema Mismatches (audit's primary trigger)
| ID | Description |
|----|-------------|
| A1 | `get_tools_by_category` missing `description` column — data corruption |

### SQL Injection / Unsafe Query Construction
| ID | Description |
|----|-------------|
| A2 | `sort_by`/`sort_order` f-string interpolation in ORDER BY |
| A3 | Dynamic UPDATE via unvalidated field names |
| A30 | F-string interpolation of conditional WHERE clause |

### Silent Exception Swallowing (no logging)
| ID | Description |
|----|-------------|
| A6 | `create_tool` endpoint |
| A7 | `browse_tools` endpoint |
| A8 | `update_tool` endpoint |
| A9 | `delete_tool` endpoint |
| A22 | `delete_review` endpoint |
| A26/A27 | WebSocket notification handler |
| A29 | Per-user broadcast notification failure |

### Missing Authentication / Authorization
| ID | Description |
|----|-------------|
| A24 | Platform review statistics — no admin check |
| A25 | Admin broadcast — check commented out (CRITICAL) |
| A33 | Admin DDL endpoint — completely unauthenticated |

### Race Conditions
| ID | Description |
|----|-------------|
| A13 | TOCTOU in booking creation (availability check → insert) |
| A23 | Review delete then rating update not in same transaction |

### Type / Data Mismatches
| ID | Description |
|----|-------------|
| A17/A18 | `float()` passed to `Numeric(3,2)` column |
| A28 | `create_notification` returns `None` but typed `NotificationResponse` |
| A31 | `datetime` type used where `date` is correct |

### N+1 and Performance
| ID | Description |
|----|-------------|
| A5 | Photo JOIN in `get_tool_by_id` unused; separate photo query follows |
| A20 | Double SQL execution in `get_tool_reviews` |

### Other Issues
| ID | Description |
|----|-------------|
| A4/A34/A35 | Division by zero in pagination (benign but fragile) |
| A10 | Hardcoded `"Unknown"` category in create/update responses |
| A11 | Service raises `HTTPException` directly (wrong layer) |
| A12 | Availability check unnecessarily requires auth |
| A14 | Unguarded relationship access in status machine |
| A15 | Implicit cross-join for "both roles" booking filter |
| A16 | Deposit calculation ignores tool's `deposit_amount` field |
| A21 | Endpoint calls private service method directly |
| A32 | Availability check ignores `tool.is_available` flag |

---

## Prioritized Fix Order

1. **A25** — Uncomment admin check on broadcast endpoint (CRITICAL, 5 minutes)
2. **A33** — Add auth to admin DDL endpoint or remove it (CRITICAL, 10 minutes)
3. **A24** — Add admin check to statistics endpoint (CRITICAL, 5 minutes)
4. **A1** — Fix missing `description` column in `get_tools_by_category` (CRITICAL, 15 minutes)
5. **A2, A3, A30** — Fix SQL injection vectors (HIGH, 30 minutes)
6. **A13** — Add `SELECT ... FOR UPDATE` to booking creation (HIGH, 1 hour)
7. **A6–A9, A22** — Add logging to all silent exception catchers (HIGH, 30 minutes)
8. **A23** — Wrap review delete + rating updates in single transaction (HIGH, 20 minutes)
9. **A15** — Fix implicit cross-join in booking filter (HIGH, 15 minutes)
10. **A17/A18** — Fix float/Decimal type issue in rating updates (MEDIUM, 10 minutes)
11. All remaining MEDIUM issues in priority order.