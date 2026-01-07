# Review Block 2: Database & Data Modeling

## 1. Schema Design (`prisma/schema.prisma`)
- **`User` Model**:
    - **Normalization**: `experience_fields` and `qualification_certificates` are `Json?`. This is flexible but harder to query efficiently compared to relational tables if specific filtering constitutes a core feature.
    - **Arrays**: `qualifications`, `desired_work_days`, `work_histories` are `String[]` (Postgres array). This is acceptable for simple lists but limits referential integrity compared to M:N tables.
    - `current_work_style`, `desired_work_style`, etc., are raw Strings. Suggest using Enums if values are fixed.
    - **Map Attributes**: Heavy use of `@map("snake_case_name")`. Good for DB convention consistency.
    - **Naming**: `role String @default("admin")` in `FacilityAdmin`. A string type for role is fragile. Should be an Enum.
- **`Facility` Model**:
    - **Normalization**: `stations`, `images`, `staff_emails` (array), `transportation` (array). Similar observation as User model; convenience vs strictness.
    - **Redundancy**: `review_count` and `rating` are stored on the parent `Facility` model. This is a common performance optimization (denormalization), provided there's a reliable mechanism to update them when `reviews` change.
- **`Job` Model**:
    - **Status**: `JobStatus` enum (DRAFT, PUBLISHED, etc.) is good.
    - **Boolean Flags**: Large number of boolean flags (`allow_car`, `allow_bike` etc.). This table is getting wide. Suggest grouping these into a `JobAttribute` or `JobConditions` table or JSON if they change frequently or are just for display.
    - **Relations**: `Job` has `workDates` (One-to-Many). This supports multiple shifts for one job definition. Good design for "recurring" or "multi-slot" jobs.
- **`JobWorkDate` Model**:
    - Unique Constraint `@@unique([job_id, work_date])` ensures no duplicate dates for same job ID. Good.
    - Redundant `recruitment_count`? It is also in `Job`. The `JobWorkDate` one likely overrides or tracks specific date capacity. Logic needs to be consistent.
- **`Application` Model**:
    - **Composite Status**: `status` (WorkerStatus), plus `worker_review_status`, `facility_review_status`. Complex state management.
    - **Unique Constraint**: `@@unique([work_date_id, user_id])`. Prevents double application for same specific slot. Good.
- **`Review` Model**:
    - Polymorphic-ish: related to `job_id`, `work_date_id`, `application_id`.
    - **Constraint**: `@@unique([job_id, user_id, reviewer_type])`. This means a user can review a *Job* only once per type? What if they work multiple dates on the same Job ID? If `JobID` is the "posting" and `JobWorkDate` is the real instance, maybe review should be tied to `work_date_id` or `application_id` primarily? This constraint might prevent reviewing the same job definition worked on two different days.
- **Enums**:
    - `JobStatus`, `WorkerStatus`, etc., are well defined.

## 2. Seeding (`prisma/seed.ts`)
- **Complexity**: The seed script is very detailed, simulating a realistic environment (Facilities, Users, Jobs, Applications, Reviews).
- **Hardcoded Data**: Uses hardcoded lists for names, qualified types.
- **Logic**: It calculates wages and dates dynamically. Good for dev environments.

## Summary of Findings (Block 2)
1.  **Optimization**: `User` and `Facility` models rely heavily on String Arrays and JSON columns. While flexible, this prevents strict strong-typing and foreign key constraints for things like `qualifications` or `stations`.
2.  **Risk**: `FacilityAdmin.role` is a String, not an Enum. Typo risk.
3.  **Logical Issue**: `Review` unique constraint `[job_id, user_id, reviewer_type]` might be too restrictive if a "Job" is a recurring posting. If a worker works twice for the same "Job" (same ID) on different dates, can they review twice? The current constraint suggests No.
4.  **Performance**: Denormalized fields `rating` and `review_count` on `Facility` need careful synchronization logic in the application layer (to be checked in Block 3).
