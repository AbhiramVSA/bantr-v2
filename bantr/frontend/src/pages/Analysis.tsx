import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { analyzeDebate, getAnalysis, getDebate } from "../services/debates";
import type { Analysis as AnalysisType, Debate } from "../types/debate";
import { ApiError } from "../types/api";

function SectionList({ title, items }: { title: string; items: Array<Record<string, unknown>> }) {
  return (
    <Card className="p-8">
      <h2 className="text-2xl font-headline font-extrabold text-on-background">{title}</h2>
      <div className="mt-6 space-y-4">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-2xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">
              <pre className="whitespace-pre-wrap font-body">{JSON.stringify(item, null, 2)}</pre>
            </div>
          ))
        ) : (
          <p className="text-on-surface-variant">No structured items returned yet.</p>
        )}
      </div>
    </Card>
  );
}

export function Analysis() {
  const { id = "" } = useParams();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const debateResponse = await getDebate(id);
      setDebate(debateResponse);

      try {
        const analysisResponse = await getAnalysis(id);
        setAnalysis(analysisResponse);
      } catch (issue) {
        if (issue instanceof ApiError && issue.code === "ANALYSIS_NOT_FOUND") {
          setAnalysis(null);
          return;
        }

        throw issue;
      }
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load analysis.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  async function handleGenerate() {
    if (debate?.status !== "completed") {
      setError("Analysis is only available after the debate completes.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const response = await analyzeDebate(id);
      setAnalysis(response);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to generate analysis.");
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = debate?.status === "completed" && !analysis;

  return (
    <PageContainer className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">Debate Analysis</h1>
          <p className="mt-3 text-lg text-on-surface-variant">Structured Bantr coaching output for the completed debate.</p>
        </div>
        {canGenerate ? (
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Generate Analysis"}
          </Button>
        ) : (
          <div className="rounded-full bg-surface-container px-5 py-3 text-sm font-bold text-on-surface-variant">
            {analysis
              ? "Analysis Ready"
              : debate?.status === "completed"
                ? "Analysis pending generation"
                : "Complete the debate to unlock analysis"}
          </div>
        )}
      </div>

      {loading ? <Spinner /> : null}
      {error && !analysis ? <ErrorState message={error} onRetry={loadAnalysis} /> : null}

      {analysis ? (
        <>
          {error ? <ErrorState message={error} /> : null}
          <Card className="p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-2xl font-headline font-extrabold text-on-background">Overall Summary</h2>
                <p className="mt-4 leading-relaxed text-on-surface-variant">{analysis.overall_summary}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-6">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Winner</div>
                <div className="mt-3 text-3xl font-headline font-extrabold text-on-background">
                  {analysis.winner ?? "No winner yet"}
                </div>
              </div>
            </div>
          </Card>
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="p-8">
              <h2 className="text-2xl font-headline font-extrabold text-on-background">Argument Strength</h2>
              <pre className="mt-6 whitespace-pre-wrap rounded-2xl bg-surface-container-low p-4 text-sm font-body text-on-surface">
                {JSON.stringify(analysis.argument_strength, null, 2)}
              </pre>
            </Card>
            <Card className="p-8">
              <h2 className="text-2xl font-headline font-extrabold text-on-background">Persuasiveness</h2>
              <pre className="mt-6 whitespace-pre-wrap rounded-2xl bg-surface-container-low p-4 text-sm font-body text-on-surface">
                {JSON.stringify(analysis.persuasiveness, null, 2)}
              </pre>
            </Card>
            <SectionList title="Logical Fallacies" items={analysis.logical_fallacies} />
            <SectionList title="Key Moments" items={analysis.key_moments} />
            <SectionList title="Improvement Areas" items={analysis.improvement_areas} />
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}
