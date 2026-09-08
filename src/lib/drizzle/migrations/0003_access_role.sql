-- Replace the two isAdmin/isManager booleans with a single access_role enum
-- (admin / editor / learner) — see the comment on accessRoleEnum in schema.ts.
CREATE TYPE "public"."access_role" AS ENUM('admin', 'editor', 'learner');
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "access_role" "access_role" NOT NULL DEFAULT 'learner';
--> statement-breakpoint
UPDATE "profiles" SET "access_role" = CASE
  WHEN "is_admin" THEN 'admin'::access_role
  WHEN "is_manager" THEN 'editor'::access_role
  ELSE 'learner'::access_role
END;
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "is_admin";
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "is_manager";
