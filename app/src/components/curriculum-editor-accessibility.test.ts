import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("accessibilité des panneaux Curriculum Studio", () => {
  it("conserve toutes les cibles aria-controls et expose l’intégralité de la proposition", async () => {
    const [component, css] = await Promise.all([
      readFile(join(process.cwd(), "src/components/curriculum-editor.tsx"), "utf8"),
      readFile(join(process.cwd(), "src/app/globals.css"), "utf8"),
    ]);

    expect(component).toContain("aria-controls={`curriculum-panel-${item}`}");
    for (const mode of ["guide", "visual", "json", "interview"]) {
      expect(component).toContain(`id="curriculum-panel-${mode}"`);
      expect(component).toContain(`hidden={mode !== "${mode}"}`);
    }
    expect(css).toMatch(/\.bx-editor-panel\[hidden\]\s*\{\s*display:\s*none;/);
    expect(component).toContain('t("studio.appliedTitle")');
    expect(component).toContain('t("studio.editAnswer")');
    expect(component).toContain('t("studio.confirm")');
    expect(component).toContain("await applyInterviewDocument(parsed.value.document)");
    expect(component).toContain("await active.save(document)");
    expect(component).toContain("canRetryInterviewProposal(interviewResult, interviewNetworkValidated)");
    expect(component).toContain("shouldStartCurriculumAutosave({");
    expect(component).toContain("if (!acquireInterviewRequestLock(interviewRequestLockRef)) return");
    expect(component).toContain("releaseInterviewRequestLock(interviewRequestLockRef)");
    expect(component).toContain('t("studio.message.sessionExpired")');
    expect(component).toContain('disabled={saveState === "saving" || interviewLoading}');
    expect(component).toContain('t("studio.correctSummary")');
    for (const field of ["keyTakeaways", "lesson.prompt", "source.why", "source.accessNote", "source.segmentLabel", "card.front", "card.back"]) expect(component).toContain(field);
    expect(component).toContain('t("studio.fullJson")');
  });
});
