ALTER TABLE "assignments" DROP CONSTRAINT "assignments_assigned_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "certification_events" DROP CONSTRAINT "certification_events_actor_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "certifications" DROP CONSTRAINT "certifications_certified_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "module_versions" DROP CONSTRAINT "module_versions_published_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "practical_evaluations" DROP CONSTRAINT "practical_evaluations_evaluator_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "assigned_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "certification_events" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_events" ADD CONSTRAINT "certification_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_certified_by_profiles_id_fk" FOREIGN KEY ("certified_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_published_by_profiles_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practical_evaluations" ADD CONSTRAINT "practical_evaluations_evaluator_id_profiles_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;