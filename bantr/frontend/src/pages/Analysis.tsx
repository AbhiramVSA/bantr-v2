import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { analyzeDebate, getAnalysis, getDebate, getTranscript } from "../services/debates";
import type {
  Analysis as AnalysisType,
  Debate,
  Transcript as TranscriptType,
  TranscriptSpeakerSegment,
} from "../types/debate";
import { ApiError } from "../types/api";
import { formatDate } from "../utils/format";

type SpeakerKey = "user" | "agent";

type SpeakerMetrics = {
  turns: number;
  words: number;
  characters: number;
  longestTurnWords: number;
  averageWordsPerTurn: number;
  talkShare: number;
  turnShare: number;
};

type TranscriptMetrics = {
  totalTurns: number;
  totalWords: number;
  totalCharacters: number;
  speakerMetrics: Record<SpeakerKey, SpeakerMetrics>;
};

const speakerLabel: Record<SpeakerKey, string> = {
  user: "You",
  agent: "Agent",
};

const speakerAccent: Record<SpeakerKey, string> = {
  user: "from-cyan-500 to-sky-500",
  agent: "from-indigo-500 to-violet-500",
};

const speakerAccentSoft: Record<SpeakerKey, string> = {
  user: "bg-cyan-500/12 text-cyan-700 ring-1 ring-cyan-200",
  agent: "bg-violet-500/12 text-violet-700 ring-1 ring-violet-200",
};

function getWordCount(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function normalizeSegment(segment: TranscriptSpeakerSegment): { speaker: SpeakerKey; text: string } | null {
  const speaker = segment.speaker === "user" ? "user" : segment.speaker === "agent" ? "agent" : null;
  const text = typeof segment.text === "string" ? segment.text.trim() : "";

  if (!speaker || !text) {
    return null;
  }

  return { speaker, text };
}

function buildTranscriptMetrics(transcript: TranscriptType | null): TranscriptMetrics {
  const baseSpeakerMetrics: Record<SpeakerKey, SpeakerMetrics> = {
    user: {
      turns: 0,
      words: 0,
      characters: 0,
      longestTurnWords: 0,
      averageWordsPerTurn: 0,
      talkShare: 0,
      turnShare: 0,
    },
    agent: {
      turns: 0,
      words: 0,
      characters: 0,
      longestTurnWords: 0,
      averageWordsPerTurn: 0,
      talkShare: 0,
      turnShare: 0,
    },
  };

  if (!transcript) {
    return {
      totalTurns: 0,
      totalWords: 0,
      totalCharacters: 0,
      speakerMetrics: baseSpeakerMetrics,
    };
  }

  for (const segment of transcript.speaker_segments) {
    const normalized = normalizeSegment(segment);
    if (!normalized) {
      continue;
    }

    const words = getWordCount(normalized.text);
    const characters = normalized.text.length;
    const bucket = baseSpeakerMetrics[normalized.speaker];

    bucket.turns += 1;
    bucket.words += words;
    bucket.characters += characters;
    bucket.longestTurnWords = Math.max(bucket.longestTurnWords, words);
  }

  const totalTurns = baseSpeakerMetrics.user.turns + baseSpeakerMetrics.agent.turns;
  const totalWords = baseSpeakerMetrics.user.words + baseSpeakerMetrics.agent.words;
  const totalCharacters = baseSpeakerMetrics.user.characters + baseSpeakerMetrics.agent.characters;

  for (const speaker of ["user", "agent"] as const) {
    const metrics = baseSpeakerMetrics[speaker];
    metrics.averageWordsPerTurn = metrics.turns ? metrics.words / metrics.turns : 0;
    metrics.talkShare = totalWords ? (metrics.words / totalWords) * 100 : 0;
    metrics.turnShare = totalTurns ? (metrics.turns / totalTurns) * 100 : 0;
  }

  return {
    totalTurns,
    totalWords,
    totalCharacters,
    speakerMetrics: baseSpeakerMetrics,
  };
}

function getWinnerLabel(winner: string | null) {
  if (winner === "user") {
    return "You";
  }
  if (winner === "agent") {
    return "Agent";
  }
  if (winner === "draw") {
    return "Draw";
  }
  return "Undecided";
}

function getVerdictTone(winner: string | null) {
  if (winner === "user") {
    return "You carried the debate on the current evidence.";
  }
  if (winner === "agent") {
    return "The agent built the stronger case on the available exchange.";
  }
  if (winner === "draw") {
    return "Neither side opened a decisive gap.";
  }
  return "The analysis did not declare a winner.";
}

function getDeltaLabel(userScore: number, agentScore: number) {
  const delta = Math.abs(agentScore - userScore);
  if (delta === 0) {
    return "Even";
  }

  const leader = agentScore > userScore ? "Agent" : "You";
  return `${leader} +${delta}`;
}

function getFallacyTone(fallacy: string) {
  const normalized = fallacy.toLowerCase();
  if (normalized.includes("unsupported") || normalized.includes("assertion")) {
    return "border-amber-300/60 bg-amber-50";
  }
  if (normalized.includes("overgeneral")) {
    return "border-rose-300/60 bg-rose-50";
  }
  return "border-slate-200 bg-slate-50";
}

function parseImprovementOwner(area: string): SpeakerKey | null {
  const normalized = area.toLowerCase();
  if (normalized.startsWith("user:")) {
    return "user";
  }
  if (normalized.startsWith("agent:")) {
    return "agent";
  }
  return null;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="h-full rounded-[30px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="h-1 w-full rounded-full bg-surface-container">
        <div className="h-full w-24 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500" />
      </div>
      <div className="pt-5">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant">{label}</div>
        <div className="mt-3 text-4xl font-headline font-black tracking-tight text-on-background">{value}</div>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{hint}</p>
      </div>
    </Card>
  );
}

function HorizontalComparisonRow({
  label,
  userValue,
  agentValue,
  maxValue,
  formatter = (value) => value.toFixed(1),
}: {
  label: string;
  userValue: number;
  agentValue: number;
  maxValue: number;
  formatter?: (value: number) => string;
}) {
  const safeMax = maxValue > 0 ? maxValue : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-on-surface-variant">{label}</h3>
        <div className="text-sm font-semibold text-on-surface-variant">
          {speakerLabel.user} {formatter(userValue)} / {speakerLabel.agent} {formatter(agentValue)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["user", "agent"] as const).map((speaker) => {
          const value = speaker === "user" ? userValue : agentValue;
          return (
            <div
              key={speaker}
              className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)]"
            >
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-on-surface">
                <span>{speakerLabel[speaker]}</span>
                <span>{formatter(value)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${speakerAccent[speaker]}`}
                  style={{ width: `${clampPercent((value / safeMax) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeakerSnapshot({
  speaker,
  score,
  persuasion,
  metrics,
}: {
  speaker: SpeakerKey;
  score: number;
  persuasion: number;
  metrics: SpeakerMetrics;
}) {
  return (
    <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant">{speakerLabel[speaker]}</div>
          <div className="mt-2 text-3xl font-headline font-black tracking-tight text-on-background">{score}/10</div>
        </div>
        <div className={`rounded-full px-4 py-2 text-sm font-bold ${speakerAccentSoft[speaker]}`}>
          Persuasion {persuasion}/10
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Turns</div>
          <div className="mt-2 text-2xl font-bold text-on-background">{metrics.turns}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Words</div>
          <div className="mt-2 text-2xl font-bold text-on-background">{metrics.words}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Talk Share</div>
          <div className="mt-2 text-2xl font-bold text-on-background">{metrics.talkShare.toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Avg Words / Turn</div>
          <div className="mt-2 text-2xl font-bold text-on-background">{metrics.averageWordsPerTurn.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

export function Analysis() {
  const { id = "" } = useParams();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisType | null>(null);
  const [transcript, setTranscript] = useState<TranscriptType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const debateResponse = await getDebate(id);
      setDebate(debateResponse);

      const [analysisResult, transcriptResult] = await Promise.allSettled([getAnalysis(id), getTranscript(id)]);

      if (analysisResult.status === "fulfilled") {
        setAnalysis(analysisResult.value);
      } else if (analysisResult.reason instanceof ApiError && analysisResult.reason.code === "ANALYSIS_NOT_FOUND") {
        setAnalysis(null);
      } else {
        throw analysisResult.reason;
      }

      if (transcriptResult.status === "fulfilled") {
        setTranscript(transcriptResult.value);
      } else if (transcriptResult.reason instanceof ApiError && transcriptResult.reason.code === "TRANSCRIPT_NOT_FOUND") {
        setTranscript(null);
      } else {
        throw transcriptResult.reason;
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
  const transcriptMetrics = buildTranscriptMetrics(transcript);

  const groupedImprovements = {
    user: analysis?.improvement_areas.filter((item) => parseImprovementOwner(String(item.area ?? "")) === "user") ?? [],
    agent: analysis?.improvement_areas.filter((item) => parseImprovementOwner(String(item.area ?? "")) === "agent") ?? [],
    general: analysis?.improvement_areas.filter((item) => parseImprovementOwner(String(item.area ?? "")) === null) ?? [],
  };

  return (
    <PageContainer className="space-y-8 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">Debate Analysis</h1>
          <p className="mt-3 max-w-3xl text-lg text-on-surface-variant">
            A score-led coaching dashboard for the completed debate. It blends model judgment with transcript-derived debate dynamics.
          </p>
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

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
            <Card className="rounded-[36px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-start justify-between gap-8">
                <div className="max-w-3xl">
                  <div className="inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-700 ring-1 ring-cyan-200">
                    Overall Read
                  </div>
                  <h2 className="mt-5 max-w-3xl text-3xl font-headline font-black tracking-tight text-on-background">
                    {getVerdictTone(analysis.winner)}
                  </h2>
                  <p className="mt-5 text-base leading-8 text-on-surface-variant">{analysis.overall_summary}</p>
                </div>
                <div className="w-full max-w-[320px] rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                  <div className="max-w-3xl">
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant">Winner</div>
                    <div className="mt-3 text-4xl font-headline font-black tracking-tight text-on-background">
                      {getWinnerLabel(analysis.winner)}
                    </div>
                    <div className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Generated</div>
                    <div className="mt-2 text-sm font-semibold text-on-surface">{formatDate(analysis.created_at)}</div>
                    {debate ? (
                      <>
                        <div className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Topic</div>
                        <div className="mt-2 text-sm leading-relaxed text-on-surface">{debate.topic}</div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid auto-rows-fr gap-4">
              <MetricCard
                label="Argument Margin"
                value={getDeltaLabel(
                  analysis.argument_strength.user_score as number,
                  analysis.argument_strength.agent_score as number,
                )}
                hint="Compares the structured strength of each side's case."
              />
              <MetricCard
                label="Persuasion Margin"
                value={getDeltaLabel(
                  analysis.persuasiveness.user_rating as number,
                  analysis.persuasiveness.agent_rating as number,
                )}
                hint="Tracks who sounded more convincing in the transcript."
              />
              <MetricCard
                label="Total Turns"
                value={String(transcriptMetrics.totalTurns)}
                hint="Derived from the saved speaker segments."
              />
              <MetricCard
                label="Total Words"
                value={String(transcriptMetrics.totalWords)}
                hint="Useful for seeing whether one side controlled the airtime."
              />
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-headline font-black text-on-background">Scoreboard</h2>
                  <p className="mt-2 text-sm text-on-surface-variant">Judgment scores and transcript balance shown side by side.</p>
                </div>
              </div>
              <div className="mt-8 space-y-8">
                <HorizontalComparisonRow
                  label="Argument Strength"
                  userValue={Number(analysis.argument_strength.user_score)}
                  agentValue={Number(analysis.argument_strength.agent_score)}
                  maxValue={10}
                  formatter={(value) => value.toFixed(0)}
                />
                <HorizontalComparisonRow
                  label="Persuasiveness"
                  userValue={Number(analysis.persuasiveness.user_rating)}
                  agentValue={Number(analysis.persuasiveness.agent_rating)}
                  maxValue={10}
                  formatter={(value) => value.toFixed(0)}
                />
                <HorizontalComparisonRow
                  label="Talk Share"
                  userValue={transcriptMetrics.speakerMetrics.user.talkShare}
                  agentValue={transcriptMetrics.speakerMetrics.agent.talkShare}
                  maxValue={100}
                  formatter={(value) => `${value.toFixed(0)}%`}
                />
                <HorizontalComparisonRow
                  label="Turn Share"
                  userValue={transcriptMetrics.speakerMetrics.user.turnShare}
                  agentValue={transcriptMetrics.speakerMetrics.agent.turnShare}
                  maxValue={100}
                  formatter={(value) => `${value.toFixed(0)}%`}
                />
              </div>
            </Card>

            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Rationale</h2>
              <div className="mt-6 space-y-6">
                <div className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Argument Strength Reasoning</div>
                  <p className="mt-4 text-sm leading-7 text-on-surface">{String(analysis.argument_strength.reasoning ?? "")}</p>
                </div>
                <div className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Persuasiveness Summary</div>
                  <p className="mt-4 text-sm leading-7 text-on-surface">{String(analysis.persuasiveness.summary ?? "")}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-8 xl:grid-cols-2">
            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Speaker Snapshots</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <SpeakerSnapshot
                  speaker="user"
                  score={Number(analysis.argument_strength.user_score)}
                  persuasion={Number(analysis.persuasiveness.user_rating)}
                  metrics={transcriptMetrics.speakerMetrics.user}
                />
                <SpeakerSnapshot
                  speaker="agent"
                  score={Number(analysis.argument_strength.agent_score)}
                  persuasion={Number(analysis.persuasiveness.agent_rating)}
                  metrics={transcriptMetrics.speakerMetrics.agent}
                />
              </div>
            </Card>

            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Debate Dynamics</h2>
              <div className="mt-6 space-y-6">
                <div className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-6">
                  <div className="flex items-center justify-between gap-4 text-sm font-semibold text-on-surface">
                    <span>Words spoken</span>
                    <span>{transcriptMetrics.totalWords} total</span>
                  </div>
                  <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-sky-500"
                      style={{ width: `${clampPercent(transcriptMetrics.speakerMetrics.user.talkShare)}%` }}
                    />
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500"
                      style={{ width: `${clampPercent(transcriptMetrics.speakerMetrics.agent.talkShare)}%` }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 text-sm text-on-surface-variant">
                    <span>{speakerLabel.user}: {transcriptMetrics.speakerMetrics.user.words} words</span>
                    <span>{speakerLabel.agent}: {transcriptMetrics.speakerMetrics.agent.words} words</span>
                  </div>
                </div>

                <div className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-6">
                  <div className="flex items-center justify-between gap-4 text-sm font-semibold text-on-surface">
                    <span>Turns taken</span>
                    <span>{transcriptMetrics.totalTurns} total</span>
                  </div>
                  <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-sky-500"
                      style={{ width: `${clampPercent(transcriptMetrics.speakerMetrics.user.turnShare)}%` }}
                    />
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500"
                      style={{ width: `${clampPercent(transcriptMetrics.speakerMetrics.agent.turnShare)}%` }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 text-sm text-on-surface-variant">
                    <span>{speakerLabel.user}: {transcriptMetrics.speakerMetrics.user.turns} turns</span>
                    <span>{speakerLabel.agent}: {transcriptMetrics.speakerMetrics.agent.turns} turns</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Longest Turn</div>
                    <div className="mt-3 text-3xl font-black text-on-background">
                      {Math.max(
                        transcriptMetrics.speakerMetrics.user.longestTurnWords,
                        transcriptMetrics.speakerMetrics.agent.longestTurnWords,
                      )} words
                    </div>
                    <p className="mt-3 text-sm text-on-surface-variant">Longest single response by either side.</p>
                  </div>
                  <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Transcript Size</div>
                    <div className="mt-3 text-3xl font-black text-on-background">{transcriptMetrics.totalCharacters}</div>
                    <p className="mt-3 text-sm text-on-surface-variant">Character count of the stored transcript.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Logical Fallacies</h2>
              <div className="mt-6 space-y-4">
                {analysis.logical_fallacies.length ? (
                  analysis.logical_fallacies.map((item, index) => (
                    <div
                      key={`${String(item.fallacy ?? "fallacy")}-${index}`}
                      className={`rounded-3xl border p-5 ${getFallacyTone(String(item.fallacy ?? ""))}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-bold uppercase tracking-[0.16em] text-on-background">
                          {String(item.fallacy ?? "Potential issue")}
                        </div>
                        <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                          {String(item.speaker ?? "speaker")}
                        </div>
                      </div>
                      <blockquote className="mt-4 border-l-2 border-current/20 pl-4 text-sm leading-7 text-on-surface">
                        {String(item.quote ?? "")}
                      </blockquote>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-on-surface-variant">No clear logical fallacies were flagged in this excerpt.</p>
                )}
              </div>
            </Card>

            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Key Moments</h2>
              <div className="mt-6 space-y-5">
                {analysis.key_moments.length ? (
                  analysis.key_moments.map((item, index) => (
                    <div
                      key={`${String(item.speaker ?? "speaker")}-${index}`}
                      className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-6"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                          Moment {index + 1}
                        </div>
                        <div className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                          {String(item.speaker ?? "speaker")}
                        </div>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-on-background">{String(item.description ?? "")}</h3>
                      <p className="mt-3 text-sm leading-7 text-on-surface">{String(item.impact ?? "")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-on-surface-variant">No standout moments were returned.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-8 xl:grid-cols-3">
            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Coaching for You</h2>
              <div className="mt-6 space-y-4">
                {groupedImprovements.user.length ? (
                  groupedImprovements.user.map((item, index) => (
                    <div key={`user-${index}`} className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-5">
                      <div className="text-sm font-bold text-on-background">{String(item.area ?? "")}</div>
                      <p className="mt-3 text-sm leading-7 text-on-surface">{String(item.suggestion ?? "")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-on-surface-variant">No user-specific coaching items were returned.</p>
                )}
              </div>
            </Card>

            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">Coaching for Agent</h2>
              <div className="mt-6 space-y-4">
                {groupedImprovements.agent.length ? (
                  groupedImprovements.agent.map((item, index) => (
                    <div key={`agent-${index}`} className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-5">
                      <div className="text-sm font-bold text-on-background">{String(item.area ?? "")}</div>
                      <p className="mt-3 text-sm leading-7 text-on-surface">{String(item.suggestion ?? "")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-on-surface-variant">No agent-specific coaching items were returned.</p>
                )}
              </div>
            </Card>

            <Card className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-headline font-black text-on-background">General Improvements</h2>
              <div className="mt-6 space-y-4">
                {groupedImprovements.general.length ? (
                  groupedImprovements.general.map((item, index) => (
                    <div key={`general-${index}`} className="rounded-[28px] border border-outline-variant/10 bg-surface-container-low p-5">
                      <div className="text-sm font-bold text-on-background">{String(item.area ?? "")}</div>
                      <p className="mt-3 text-sm leading-7 text-on-surface">{String(item.suggestion ?? "")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-on-surface-variant">No general coaching items were returned.</p>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}
