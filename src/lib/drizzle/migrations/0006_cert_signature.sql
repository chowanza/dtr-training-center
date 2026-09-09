ALTER TABLE "certifications" ADD COLUMN "signature_data" text;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "signed_at" timestamp with time zone;