import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import z from "zod";

import { client, orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/setup/")({
  component: SetupComponent,
});

type SetupStep = "admin" | "scrapers" | "flaresolverr";

const steps: { key: SetupStep; title: string }[] = [
  { key: "admin", title: "Admin Account" },
  { key: "scrapers", title: "Built-in Scrapers" },
  { key: "flaresolverr", title: "FlareSolverr" },
];

function StepIndicator({
  currentStep,
  completedSteps,
  onNavigate,
}: {
  currentStep: SetupStep;
  completedSteps: SetupStep[];
  onNavigate: (step: SetupStep) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const adminCompleted = completedSteps.includes("admin");
  // Progress: each step contributes 1/n, current step adds a half-step
  const progressPct = ((currentIndex + 0.5) / steps.length) * 100;

  return (
    <div className="space-y-3">
      {/* Continuous track */}
      <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step labels */}
      <div className="flex">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = currentStep === step.key;
          // Can only navigate freely once admin is completed; admin step itself is then locked
          const canNavigate = adminCompleted && step.key !== "admin";

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => canNavigate && onNavigate(step.key)}
              disabled={!canNavigate}
              className={`flex-1 flex flex-col ${
                index === 0 ? "items-start" : index === steps.length - 1 ? "items-end" : "items-center"
              } ${
                canNavigate ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className={`text-xs transition-colors ${
                  isCurrent
                    ? "text-foreground font-medium"
                    : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {step.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SetupComponent() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<SetupStep>("admin");
  const [completedSteps, setCompletedSteps] = useState<SetupStep[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch setup status to restore progress
  const { data: setupStatus, isLoading: isLoadingStatus } = useQuery(
    orpc.setup.getStatus.queryOptions()
  );

  // Initialize state from setup status
  useEffect(() => {
    if (setupStatus?.setupProgress && !isInitialized) {
      setCurrentStep(setupStatus.setupProgress.currentStep);
      setCompletedSteps(setupStatus.setupProgress.completedSteps);
      setIsInitialized(true);
    }
  }, [setupStatus, isInitialized]);

  // Mutation to update progress in the database
  const updateProgressMutation = useMutation({
    mutationFn: async (data: { currentStep: SetupStep; completedSteps: SetupStep[] }) => {
      return await client.setup.updateProgress(data);
    },
  });

  // Update progress in database whenever it changes
  useEffect(() => {
    if (isInitialized) {
      updateProgressMutation.mutate({ currentStep, completedSteps });
    }
  }, [currentStep, completedSteps]);

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const markStepCompleted = (step: SetupStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key);
    }
  };

  const finishSetup = useMutation({
    mutationFn: async () => {
      return await client.setup.completeSetup();
    },
    onSuccess: () => {
      toast.success("Setup completed successfully!");
      navigate({ to: "/" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to complete setup");
    },
  });

  if (isLoadingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStepMeta = steps[currentStepIndex];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-10">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Minato
          </h1>
          <p className="text-sm text-muted-foreground">Initial setup</p>
        </div>

        {/* Step indicator */}
        <StepIndicator
          currentStep={currentStep}
          completedSteps={completedSteps}
          onNavigate={(step) => {
            if (completedSteps.includes("admin") && step !== "admin") {
              setCurrentStep(step);
            }
          }}
        />

        {/* Step heading */}
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {currentStepMeta.title}
          </h2>
        </div>

        {/* Step content */}
        <div>
          {currentStep === "admin" && (
            <AdminStep
              onComplete={() => {
                markStepCompleted("admin");
                goToNextStep();
              }}
            />
          )}
          {currentStep === "scrapers" && (
            <ScrapersStep
              onComplete={() => {
                markStepCompleted("scrapers");
                goToNextStep();
              }}
              onSkip={goToNextStep}
              onBack={() => {
                if (!completedSteps.includes("admin")) {
                  setCurrentStep("admin");
                }
              }}
            />
          )}
          {currentStep === "flaresolverr" && (
            <FlareSolverrStep
              onComplete={() => {
                markStepCompleted("flaresolverr");
                finishSetup.mutate();
              }}
              onSkip={() => finishSetup.mutate()}
              onBack={() => setCurrentStep("scrapers")}
            />
          )}
        </div>

      </div>
    </div>
  );
}

function AdminStep({ onComplete }: { onComplete: () => void }) {
  const createAdminMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      return await client.setup.createAdmin(data);
    },
    onSuccess: () => {
      toast.success("Admin account created");
      onComplete();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create admin account");
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      createAdminMutation.mutate({
        name: value.name,
        email: value.email,
        password: value.password,
      });
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        This account will have full access to manage your Minato instance.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </Label>
              <Input
                id="name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Your name"
                disabled={createAdminMutation.isPending}
                className="h-10"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="admin@example.com"
                disabled={createAdminMutation.isPending}
                className="h-10"
              />
            </div>
          )}
        </form.Field>

        <div className="grid grid-cols-2 gap-3">
          <form.Field name="password">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="••••••••"
                  disabled={createAdminMutation.isPending}
                  className="h-10"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Confirm
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="••••••••"
                  disabled={createAdminMutation.isPending}
                  className="h-10"
                />
              </div>
            )}
          </form.Field>
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full h-10" disabled={createAdminMutation.isPending}>
            {createAdminMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ScrapersStep({ onComplete, onSkip, onBack }: { onComplete: () => void; onSkip: () => void; onBack: () => void }) {
  const { data: scrapersData, isLoading } = useQuery(orpc.setup.getScrapers.queryOptions());
  const [enabledScrapers, setEnabledScrapers] = useState<string[]>([]);

  // Initialize enabled scrapers when data loads
  useState(() => {
    if (scrapersData) {
      setEnabledScrapers(scrapersData.scrapers.filter((s: any) => s.enabled).map((s: any) => s.id));
    }
  });

  const updateScrapersMutation = useMutation({
    mutationFn: async (data: { enabledScrapers: string[] }) => {
      return await client.setup.updateScrapers(data);
    },
    onSuccess: () => {
      toast.success("Scrapers saved");
      onComplete();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update scrapers");
    },
  });

  const toggleScraper = (scraperId: string) => {
    setEnabledScrapers((prev) =>
      prev.includes(scraperId)
        ? prev.filter((id) => id !== scraperId)
        : [...prev, scraperId]
    );
  };

  const handleSave = () => {
    updateScrapersMutation.mutate({ enabledScrapers });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Choose which torrent indexers to enable. You can change these later in settings.
      </p>

      <div className="space-y-1">
        {scrapersData?.scrapers.map((scraper: any) => (
          <div
            key={scraper.id}
            className="flex items-center justify-between py-3 border-b border-border last:border-0"
          >
            <div>
              <div className="text-sm font-medium">{scraper.name}</div>
              {scraper.description && (
                <div className="text-xs text-muted-foreground mt-0.5">{scraper.description}</div>
              )}
            </div>
            <Switch
              checked={enabledScrapers.includes(scraper.id)}
              onCheckedChange={() => toggleScraper(scraper.id)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          Back
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
          Skip
        </Button>
        <Button onClick={handleSave} size="sm" disabled={updateScrapersMutation.isPending} className="min-w-24">
          {updateScrapersMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}

function FlareSolverrStep({ onComplete, onSkip, onBack }: { onComplete: () => void; onSkip: () => void; onBack: () => void }) {
  const [url, setUrl] = useState("http://localhost:8191");
  const [checkResult, setCheckResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkMutation = useMutation({
    mutationFn: async (testUrl: string) => {
      return await client.setup.checkFlareSolverr({ url: testUrl });
    },
    onSuccess: (data) => {
      setCheckResult(data);
      if (data.success) {
        toast.success("FlareSolverr connected");
      } else {
        toast.warning(data.message);
      }
    },
    onError: (error) => {
      const message = error.message || "Failed to check FlareSolverr";
      setCheckResult({ success: false, message });
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newUrl: string) => {
      return await client.setup.updateFlareSolverr({ url: newUrl });
    },
    onSuccess: () => {
      toast.success("FlareSolverr URL saved");
      onComplete();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update FlareSolverr URL");
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        FlareSolverr helps bypass Cloudflare protection on some torrent sites. This is optional — you can skip and configure it later.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="flaresolverr-url" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Instance URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="flaresolverr-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8191"
              disabled={checkMutation.isPending || updateMutation.isPending}
              className="h-10 font-mono text-sm"
            />
            <Button
              variant="outline"
              onClick={() => checkMutation.mutate(url)}
              disabled={checkMutation.isPending || updateMutation.isPending}
              className="h-10 shrink-0"
            >
              {checkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Test"
              )}
            </Button>
          </div>
        </div>

        {checkResult && (
          <div
            className={`px-3 py-2.5 rounded-md text-xs border ${
              checkResult.success
                ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            {checkResult.message}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={updateMutation.isPending} className="text-muted-foreground">
          Back
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={updateMutation.isPending} className="text-muted-foreground">
          Skip
        </Button>
        <Button
          onClick={() => updateMutation.mutate(url)}
          size="sm"
          disabled={updateMutation.isPending}
          className="min-w-24"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Finish"
          )}
        </Button>
      </div>
    </div>
  );
}
