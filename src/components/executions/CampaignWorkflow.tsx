"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { CampaignLead } from "@/types/database";
import { Step1LeadInput } from "./steps/Step1LeadInput";
import { Step2QualifyLeads } from "./steps/Step2QualifyLeads";
import { Step3Exclusions } from "./steps/Step3Exclusions";
import { Step4GenerateSequences } from "./steps/Step4GenerateSequences";
import { Step5Push } from "./steps/Step5Push";
import { Step6Report } from "./steps/Step6Report";

const STEPS = [
  { number: 1, label: "Import Leads" },
  { number: 2, label: "Qualify" },
  { number: 3, label: "Exclusions" },
  { number: 4, label: "Sequences" },
  { number: 5, label: "Push" },
  { number: 6, label: "Report" },
];

export function CampaignWorkflow({
  projectId,
  campaignType,
  hasApolloKey,
  hasApifyKey,
  hasOpenAIKey,
  hasHeyreachKey,
  hasInstantlyKey,
  hasHubSpotKey,
  hasSlackKey,
}: {
  projectId: string;
  campaignType?: string;
  hasApolloKey: boolean;
  hasApifyKey?: boolean;
  hasOpenAIKey: boolean;
  hasHeyreachKey: boolean;
  hasInstantlyKey: boolean;
  hasHubSpotKey: boolean;
  hasSlackKey: boolean;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [campaignRunId, setCampaignRunId] = useState<string | null>(null);

  const handleStep1Complete = (importedLeads: CampaignLead[]) => {
    setLeads(importedLeads);
    setCurrentStep(2);
  };

  const handleStep2Complete = (qualifiedLeads: CampaignLead[]) => {
    setLeads(qualifiedLeads);
    setCurrentStep(3);
  };

  const handleStep3Complete = (filteredLeads: CampaignLead[]) => {
    setLeads(filteredLeads);
    setCurrentStep(4);
  };

  const handleStep4Complete = (leadsWithSequences: CampaignLead[]) => {
    setLeads(leadsWithSequences);
    setCurrentStep(5);
  };

  const handleStep5Complete = (runId: string | null) => {
    setCampaignRunId(runId);
    setCurrentStep(6);
  };

  const handleStep6Complete = () => {
    setCurrentStep(1);
    setLeads([]);
    setCampaignRunId(null);
  };

  return (
    <div className="space-y-6">
      {/* Step progress bar */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const isDone = currentStep > step.number;
          const isActive = currentStep === step.number;
          return (
            <div key={step.number} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors ${
                    isDone
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                </div>
                <span className={`text-xs mt-1 font-medium whitespace-nowrap ${
                  isActive ? "text-foreground" : isDone ? "text-green-600" : "text-muted-foreground"
                }`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${isDone ? "bg-green-400" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Lead count pill */}
      {leads.length > 0 && currentStep > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 bg-muted rounded-full font-medium">{leads.length} leads in pipeline</span>
        </div>
      )}

      {/* Step content */}
      <div className="border rounded-xl p-5 bg-card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {currentStep}
          </span>
          {STEPS[currentStep - 1]?.label}
        </h3>

        {currentStep === 1 && (
          <Step1LeadInput
            projectId={projectId}
            campaignType={campaignType}
            hasApolloKey={hasApolloKey}
            hasApifyKey={hasApifyKey}
            hasHubSpotKey={hasHubSpotKey}
            onComplete={handleStep1Complete}
          />
        )}
        {currentStep === 2 && (
          <Step2QualifyLeads
            projectId={projectId}
            leads={leads}
            hasOpenAIKey={hasOpenAIKey}
            onComplete={handleStep2Complete}
          />
        )}
        {currentStep === 3 && (
          <Step3Exclusions
            projectId={projectId}
            leads={leads}
            hasInstantlyKey={hasInstantlyKey}
            hasHubSpotKey={hasHubSpotKey}
            onComplete={handleStep3Complete}
          />
        )}
        {currentStep === 4 && (
          <Step4GenerateSequences
            projectId={projectId}
            leads={leads}
            hasOpenAIKey={hasOpenAIKey}
            hasHeyreachKey={hasHeyreachKey}
            onComplete={handleStep4Complete}
          />
        )}
        {currentStep === 5 && (
          <Step5Push
            projectId={projectId}
            leads={leads}
            hasInstantlyKey={hasInstantlyKey}
            hasHubSpotKey={hasHubSpotKey}
            onComplete={handleStep5Complete}
          />
        )}
        {currentStep === 6 && (
          <Step6Report
            projectId={projectId}
            campaignRunId={campaignRunId}
            leadsCount={leads.length}
            hasInstantlyKey={hasInstantlyKey}
            hasSlackKey={hasSlackKey}
            onComplete={handleStep6Complete}
          />
        )}
      </div>
    </div>
  );
}
