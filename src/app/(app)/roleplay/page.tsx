import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { Sparkles, CheckCircle2 } from "lucide-react";

export default async function RoleplayIndexPage() {
  const user = await requireCurrentUser();
  const orgId = user.organizationId;

  const { scenarios, moduleTitleById, sessionByScenarioId } = await withTenantContext(orgId, async (tx) => {
    const publishedModules = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, orgId), eq(schema.modules.status, "published")));
    const moduleTitleById = new Map(publishedModules.map((m) => [m.id, m.title]));
    const moduleIds = publishedModules.map((m) => m.id);

    if (moduleIds.length === 0) return { scenarios: [], moduleTitleById, sessionByScenarioId: new Map() };

    const moduleVersionRows = await tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, orgId), inArray(schema.moduleVersions.moduleId, moduleIds)));
    const mvIdToModuleId = new Map(moduleVersionRows.map((mv) => [mv.id, mv.moduleId]));
    const mvIds = moduleVersionRows.map((mv) => mv.id);

    const scenarioRows = mvIds.length
      ? await tx.select().from(schema.aiRoleplayScenarios).where(and(eq(schema.aiRoleplayScenarios.organizationId, orgId), inArray(schema.aiRoleplayScenarios.moduleVersionId, mvIds)))
      : [];
    const scenarios = scenarioRows.map((s) => ({ ...s, moduleId: mvIdToModuleId.get(s.moduleVersionId)! })).filter((s) => s.moduleId);

    const scenarioIds = scenarios.map((s) => s.id);
    const sessionRows = scenarioIds.length
      ? await tx
          .select()
          .from(schema.aiRoleplaySessions)
          .where(and(eq(schema.aiRoleplaySessions.organizationId, orgId), eq(schema.aiRoleplaySessions.userId, user.id), inArray(schema.aiRoleplaySessions.scenarioId, scenarioIds)))
      : [];
    const sessionByScenarioId = new Map(sessionRows.map((s) => [s.scenarioId, s]));

    return { scenarios, moduleTitleById, sessionByScenarioId };
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="p-1.5 rounded-lg bg-copper text-navy-deep">
          <Sparkles size={16} />
        </span>
        <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight">AI Roleplay</h1>
      </div>
      <p className="text-ink-2 text-[14.5px] mb-6">Practice real conversations with an AI-simulated customer, scored against our own scripts and standards.</p>

      {scenarios.length === 0 ? (
        <div className="border border-dashed border-rule-2 rounded-xl p-8 text-center text-sm text-ink-3">
          No roleplay simulations published yet — add one from a module in Content.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {scenarios.map((s) => {
            const session = sessionByScenarioId.get(s.id);
            return (
              <Link key={s.id} href={`/learn/${s.moduleId}`} className="border border-rule rounded-xl bg-surface p-5 hover:border-navy transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-[var(--font-display)] font-semibold text-[15px]">{s.title}</h3>
                  {session?.status === "completed" && (
                    <span className={`pill shrink-0 ${session.passed ? "p-good" : "p-bad"}`}>
                      {session.passed ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={12} /> Passed
                        </span>
                      ) : (
                        "Needs Practice"
                      )}
                    </span>
                  )}
                </div>
                <p className="text-ink-2 text-[13px] leading-relaxed mb-3 line-clamp-2">{s.description}</p>
                <div className="flex items-center gap-2 text-[11px] font-[var(--font-mono)] text-ink-3">
                  <span>{moduleTitleById.get(s.moduleId)}</span>
                  <span>·</span>
                  <span>{s.maxTurns} turns</span>
                  <span>·</span>
                  <span>Pass {s.passingScore}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
