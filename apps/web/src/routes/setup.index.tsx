import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Fingerprint, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/setup/")({
	component: SetupComponent,
});

type SetupStep = "admin" | "scrapers" | "flaresolverr";

const steps: { key: SetupStep; title: string; caption: string }[] = [
	{ key: "admin", title: "Admin Account", caption: "create the operator" },
	{ key: "scrapers", title: "Scrapers", caption: "pick your indexers" },
	{ key: "flaresolverr", title: "FlareSolverr", caption: "cloudflare bypass" },
];

const easeOut = [0.22, 1, 0.36, 1] as const;

const stepVariants = {
	enter: (direction: number) => ({
		x: direction * 28,
		opacity: 0,
		filter: "blur(4px)",
	}),
	center: { x: 0, opacity: 1, filter: "blur(0px)" },
	exit: (direction: number) => ({
		x: direction * -28,
		opacity: 0,
		filter: "blur(4px)",
	}),
};

/**
 * Animates its own height to follow the measured height of its children,
 * so step changes resize the panel smoothly instead of snapping.
 */
function AnimatedHeight({ children }: { children: React.ReactNode }) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | "auto">("auto");

	useEffect(() => {
		const content = contentRef.current;
		if (!content) return;
		const observer = new ResizeObserver(([entry]) => {
			setHeight(entry.contentRect.height);
		});
		observer.observe(content);
		return () => observer.disconnect();
	}, []);

	return (
		<motion.div
			className="overflow-hidden"
			animate={{ height }}
			transition={{ duration: 0.3, ease: easeOut }}
		>
			<div ref={contentRef}>{children}</div>
		</motion.div>
	);
}

/** Staggered entrance for content inside a step. */
function Reveal({
	children,
	delay = 0,
	className,
}: {
	children: React.ReactNode;
	delay?: number;
	className?: string;
}) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay, ease: easeOut }}
		>
			{children}
		</motion.div>
	);
}

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
				<motion.div
					className="absolute inset-y-0 left-0 rounded-full bg-primary"
					initial={false}
					animate={{ width: `${progressPct}%` }}
					transition={{ type: "spring", stiffness: 180, damping: 26 }}
				/>
			</div>

			{/* Step labels */}
			<div className="flex">
				{steps.map((step, index) => {
					const isCompleted = completedSteps.includes(step.key);
					const isCurrent = currentStep === step.key;
					// After admin is done, user can freely navigate between the later steps
					const canNavigate = adminCompleted && step.key !== "admin";

					return (
						<button
							key={step.key}
							type="button"
							onClick={() => canNavigate && onNavigate(step.key)}
							disabled={!canNavigate}
							className={`flex flex-1 flex-col ${
								index === 0
									? "items-start"
									: index === steps.length - 1
										? "items-end"
										: "items-center"
							} ${canNavigate ? "cursor-pointer" : "cursor-default"}`}
						>
							<span
								className={`flex items-center gap-1 font-mono text-[11px] transition-colors duration-200 ${
									isCurrent
										? "text-foreground"
										: isCompleted
											? "text-muted-foreground"
											: "text-muted-foreground/50"
								} ${canNavigate ? "hover:text-foreground" : ""}`}
							>
								<AnimatePresence>
									{isCompleted && (
										<motion.span
											initial={{ scale: 0, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											exit={{ scale: 0, opacity: 0 }}
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 24,
											}}
											className="text-primary"
										>
											<Check className="size-3" />
										</motion.span>
									)}
								</AnimatePresence>
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
	const [direction, setDirection] = useState(1);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isFinished, setIsFinished] = useState(false);

	// Fetch setup status to restore progress
	const { data: setupStatus, isLoading: isLoadingStatus } = useQuery(
		orpc.setup.getStatus.queryOptions(),
	);

	// Restore progress from the server
	useEffect(() => {
		if (setupStatus?.setupProgress && !isInitialized) {
			setCurrentStep(setupStatus.setupProgress.currentStep);
			setCompletedSteps(setupStatus.setupProgress.completedSteps);
			setIsInitialized(true);
		}
	}, [setupStatus, isInitialized]);

	// Sync progress to the server
	const updateProgressMutation = useMutation({
		mutationFn: async (data: {
			currentStep: SetupStep;
			completedSteps: SetupStep[];
		}) => {
			return await client.setup.updateProgress(data);
		},
	});

	useEffect(() => {
		if (!isInitialized) return;
		updateProgressMutation.mutate({ currentStep, completedSteps });
	}, [currentStep, completedSteps]);

	const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

	const markStepCompleted = (step: SetupStep) => {
		if (!completedSteps.includes(step)) {
			setCompletedSteps((prev) => [...prev, step]);
		}
	};

	const goToStep = (step: SetupStep) => {
		const targetIndex = steps.findIndex((s) => s.key === step);
		setDirection(targetIndex >= currentStepIndex ? 1 : -1);
		setCurrentStep(step);
	};

	const goToNextStep = () => {
		const nextIndex = currentStepIndex + 1;
		if (nextIndex < steps.length) {
			goToStep(steps[nextIndex].key);
		}
	};

	const finishSetup = useMutation({
		mutationFn: async () => {
			return await client.setup.completeSetup();
		},
		onSuccess: () => {
			setIsFinished(true);
			setTimeout(() => navigate({ to: "/dashboard" }), 1800);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to complete setup");
		},
	});

	if (isLoadingStatus) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const currentStepMeta = steps[currentStepIndex];

	return (
		<div className="relative min-h-screen bg-background">

			<div className="relative flex min-h-screen items-center justify-center p-6">
				<motion.div
					className="w-full max-w-md space-y-8"
					initial="hidden"
					animate="visible"
					variants={{
						hidden: {},
						visible: { transition: { staggerChildren: 0.09 } },
					}}
				>
					{/* Header */}
					<motion.div
						className="space-y-1"
						variants={{
							hidden: { opacity: 0, y: 10 },
							visible: {
								opacity: 1,
								y: 0,
								transition: { duration: 0.4, ease: easeOut },
							},
						}}
					>
						<p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground/60 uppercase select-none">
							first run // setup
						</p>
						<h1 className="font-black text-3xl text-foreground tracking-tighter">
							Minato
						</h1>
					</motion.div>

					{/* Step indicator */}
					<motion.div
						variants={{
							hidden: { opacity: 0, y: 10 },
							visible: {
								opacity: 1,
								y: 0,
								transition: { duration: 0.4, ease: easeOut },
							},
						}}
					>
						<StepIndicator
							currentStep={currentStep}
							completedSteps={completedSteps}
							onNavigate={goToStep}
						/>
					</motion.div>

					{/* Step panel */}
					<motion.div
						className="relative overflow-hidden border border-border/90 bg-card/70 p-6 backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(115deg,transparent_0%,oklch(1_0_0/3%)_40%,transparent_65%)]"
						variants={{
							hidden: { opacity: 0, y: 14 },
							visible: {
								opacity: 1,
								y: 0,
								transition: { duration: 0.45, ease: easeOut },
							},
						}}
					>
						<AnimatedHeight>
							<AnimatePresence mode="wait" custom={direction} initial={false}>
							<motion.div
								key={currentStep}
								custom={direction}
								variants={stepVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={{ duration: 0.22, ease: easeOut }}
							>
								{/* Step heading */}
								<div className="mb-6 flex items-baseline gap-3">
									<span className="font-mono text-xs text-primary/70 tabular-nums select-none">
										{String(currentStepIndex + 1).padStart(2, "0")}
									</span>
									<div>
										<h2 className="font-semibold text-foreground text-lg tracking-tight">
											{currentStepMeta.title}
										</h2>
										<p className="font-mono text-[11px] text-muted-foreground/50">
											{currentStepMeta.caption}
										</p>
									</div>
								</div>

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
									/>
								)}
								{currentStep === "flaresolverr" && (
									<FlareSolverrStep
										onComplete={() => {
											markStepCompleted("flaresolverr");
											finishSetup.mutate();
										}}
										onSkip={() => finishSetup.mutate()}
										onBack={() => goToStep("scrapers")}
										isFinishing={finishSetup.isPending}
									/>
								)}
							</motion.div>
							</AnimatePresence>
						</AnimatedHeight>
					</motion.div>
				</motion.div>
			</div>

			{/* Completion overlay */}
			<AnimatePresence>
				{isFinished && <CompletionOverlay />}
			</AnimatePresence>
		</div>
	);
}

function CompletionOverlay() {
	return (
		<motion.div
			className="fixed inset-0 z-50 flex items-center justify-center bg-background"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
		>
			<div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle,var(--minato-grid-color)_1px,transparent_1px)] [background-size:28px_28px]" />

			<div className="relative flex flex-col items-center gap-6">
				<motion.div
					className="flex size-20 items-center justify-center border border-border/90 bg-card/70 backdrop-blur-sm"
					initial={{ scale: 0.6, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ type: "spring", stiffness: 320, damping: 22 }}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						className="size-9 text-primary"
						aria-hidden="true"
					>
						<motion.path
							d="M4 12.5 L10 18.5 L20 6.5"
							stroke="currentColor"
							strokeWidth={2.5}
							strokeLinecap="round"
							strokeLinejoin="round"
							initial={{ pathLength: 0 }}
							animate={{ pathLength: 1 }}
							transition={{ delay: 0.25, duration: 0.45, ease: easeOut }}
						/>
					</svg>
				</motion.div>

				<div className="space-y-2 text-center">
					<motion.p
						className="font-mono text-xs tracking-[0.25em] text-foreground uppercase"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.45, duration: 0.35, ease: easeOut }}
					>
						setup complete
					</motion.p>
					<motion.p
						className="font-mono text-[11px] text-muted-foreground/60"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.8, duration: 0.4 }}
					>
						launching dashboard...
					</motion.p>
				</div>
			</div>
		</motion.div>
	);
}

// Admin step has two substeps: create the account, then offer a passkey.
// The passkey substep is one-way — once past the form there is no path back to it.
function AdminStep({ onComplete }: { onComplete: () => void }) {
	const [showPasskey, setShowPasskey] = useState(false);

	return (
		<AnimatePresence mode="wait" initial={false}>
			{showPasskey ? (
				<motion.div
					key="passkey"
					initial={{ x: 28, opacity: 0, filter: "blur(4px)" }}
					animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
					transition={{ duration: 0.22, ease: easeOut }}
				>
					<PasskeySubstep onDone={onComplete} />
				</motion.div>
			) : (
				<motion.div
					key="account"
					exit={{ x: -28, opacity: 0, filter: "blur(4px)" }}
					transition={{ duration: 0.22, ease: easeOut }}
				>
					<AccountForm onCreated={() => setShowPasskey(true)} />
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function AccountForm({ onCreated }: { onCreated: () => void }) {
	const createAdminMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			email: string;
			password: string;
		}) => {
			return await client.setup.createAdmin(data);
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

			const result = await createAdminMutation.mutateAsync({
				name: value.name,
				email: value.email,
				password: value.password,
			});

			if (!result.success) {
				toast.error(result.message || "Failed to create admin account");
				return;
			}

			// Sign in so the browser has an authenticated session for passkey registration
			const signInResult = await authClient.signIn.email({
				email: value.email,
				password: value.password,
			});

			if (signInResult.error) {
				// Account was created — proceed anyway, passkey substep is skippable
				toast.warning(
					"Account created but sign-in failed. You can add a passkey later.",
				);
			} else {
				toast.success("Admin account created");
			}

			onCreated();
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.string().email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
				confirmPassword: z
					.string()
					.min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	return (
		<div className="space-y-6">
			<Reveal>
				<p className="text-muted-foreground text-sm leading-relaxed">
					This account will have full access to manage your Minato instance.
				</p>
			</Reveal>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<Reveal delay={0.05}>
					<form.Field name="name">
						{(field) => (
							<div className="space-y-1.5">
								<Label
									htmlFor="name"
									className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
								>
									Name
								</Label>
								<Input
									id="name"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Your name"
									disabled={form.state.isSubmitting}
									className="h-10 rounded-none transition-colors focus-visible:border-primary/50 focus-visible:ring-0"
								/>
							</div>
						)}
					</form.Field>
				</Reveal>

				<Reveal delay={0.1}>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-1.5">
								<Label
									htmlFor="email"
									className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
								>
									Email
								</Label>
								<Input
									id="email"
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="admin@example.com"
									disabled={form.state.isSubmitting}
									className="h-10 rounded-none transition-colors focus-visible:border-primary/50 focus-visible:ring-0"
								/>
							</div>
						)}
					</form.Field>
				</Reveal>

				<Reveal delay={0.15}>
					<div className="grid grid-cols-2 gap-3">
						<form.Field name="password">
							{(field) => (
								<div className="space-y-1.5">
									<Label
										htmlFor="password"
										className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
									>
										Password
									</Label>
									<Input
										id="password"
										type="password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="••••••••"
										disabled={form.state.isSubmitting}
										className="h-10 rounded-none transition-colors focus-visible:border-primary/50 focus-visible:ring-0"
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="confirmPassword">
							{(field) => (
								<div className="space-y-1.5">
									<Label
										htmlFor="confirmPassword"
										className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
									>
										Confirm
									</Label>
									<Input
										id="confirmPassword"
										type="password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="••••••••"
										disabled={form.state.isSubmitting}
										className="h-10 rounded-none transition-colors focus-visible:border-primary/50 focus-visible:ring-0"
									/>
								</div>
							)}
						</form.Field>
					</div>
				</Reveal>

				<Reveal delay={0.2} className="pt-2">
					<form.Subscribe>
						{(state) => (
							<Button
								type="submit"
								className="group h-10 w-full gap-2 rounded-none font-mono text-sm transition-transform active:scale-[0.98]"
								disabled={!state.canSubmit || state.isSubmitting}
							>
								{state.isSubmitting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<>
										Continue
										<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
									</>
								)}
							</Button>
						)}
					</form.Subscribe>
				</Reveal>
			</form>
		</div>
	);
}

function PasskeySubstep({ onDone }: { onDone: () => void }) {
	const [registered, setRegistered] = useState(false);
	const [pending, setPending] = useState(false);

	async function registerPasskey() {
		setPending(true);
		const result = await authClient.passkey.addPasskey();
		setPending(false);

		if (result?.error) {
			toast.error(result.error.message || "Failed to register passkey");
			return;
		}

		setRegistered(true);
		toast.success("Passkey registered");
	}

	return (
		<div className="space-y-6">
			<Reveal>
				<div className="space-y-1.5">
					<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
						account created — one more thing
					</p>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Passkeys let you sign in with Face ID, Touch ID, or a security key
						— no password needed. You can always add one later from the
						dashboard.
					</p>
				</div>
			</Reveal>

			<AnimatePresence mode="wait">
				{registered ? (
					<motion.div
						key="registered"
						className="flex items-center gap-3 border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
						initial={{ opacity: 0, scale: 0.97 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ type: "spring", stiffness: 380, damping: 26 }}
					>
						<motion.span
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{
								delay: 0.1,
								type: "spring",
								stiffness: 500,
								damping: 22,
							}}
						>
							<Check className="size-4 shrink-0 text-emerald-500" />
						</motion.span>
						<p className="text-emerald-600 text-sm dark:text-emerald-400">
							Passkey registered successfully.
						</p>
					</motion.div>
				) : (
					<motion.div
						key="register"
						exit={{ opacity: 0, scale: 0.97 }}
						transition={{ duration: 0.15 }}
					>
						<Reveal delay={0.08}>
							<button
								type="button"
								onClick={registerPasskey}
								disabled={pending}
								className="group relative flex w-full flex-col items-center gap-3 border border-border/60 bg-background/40 px-6 py-8 transition-colors hover:border-primary/40 disabled:pointer-events-none disabled:opacity-60"
							>
								<span className="relative flex size-12 items-center justify-center">
									{/* Idle pulse rings */}
									{!pending && (
										<motion.span
											className="absolute inset-0 rounded-full border border-primary/30"
											animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
											transition={{
												duration: 1.8,
												repeat: Number.POSITIVE_INFINITY,
												ease: "easeOut",
											}}
										/>
									)}
									<span className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/5 transition-colors group-hover:bg-primary/10">
										{pending ? (
											<Loader2 className="size-5 animate-spin text-primary" />
										) : (
											<Fingerprint className="size-5 text-primary" />
										)}
									</span>
								</span>
								<span className="font-mono text-muted-foreground text-xs transition-colors group-hover:text-foreground">
									{pending ? "waiting for device..." : "Register passkey"}
								</span>
							</button>
						</Reveal>
					</motion.div>
				)}
			</AnimatePresence>

			<Reveal delay={0.15}>
				<div className="flex items-center gap-2 pt-2">
					<div className="flex-1" />
					{!registered && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDone}
							disabled={pending}
							className="rounded-none font-mono text-muted-foreground text-xs"
						>
							Skip for now
						</Button>
					)}
					{registered && (
						<Button
							size="sm"
							onClick={onDone}
							className="group min-w-24 gap-1.5 rounded-none font-mono text-xs transition-transform active:scale-[0.98]"
						>
							Continue
							<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
						</Button>
					)}
				</div>
			</Reveal>
		</div>
	);
}

function ScrapersStep({
	onComplete,
	onSkip,
}: {
	onComplete: () => void;
	onSkip: () => void;
}) {
	const { data: scrapersData, isLoading } = useQuery(
		orpc.setup.getScrapers.queryOptions(),
	);
	const [enabledScrapers, setEnabledScrapers] = useState<string[]>([]);

	// Initialize enabled scrapers when data loads
	useEffect(() => {
		if (scrapersData) {
			setEnabledScrapers(
				scrapersData.scrapers.filter((s) => s.enabled).map((s) => s.id),
			);
		}
	}, [scrapersData]);

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
				: [...prev, scraperId],
		);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const totalScrapers = scrapersData?.scrapers.length ?? 0;

	return (
		<div className="space-y-6">
			<Reveal>
				<div className="flex items-baseline justify-between gap-4">
					<p className="text-muted-foreground text-sm leading-relaxed">
						Choose which torrent indexers to enable. You can change these later.
					</p>
					<span className="flex shrink-0 items-baseline gap-1 font-mono text-[11px] text-muted-foreground/60 tabular-nums">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={enabledScrapers.length}
								className="text-primary"
								initial={{ y: 6, opacity: 0 }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: -6, opacity: 0 }}
								transition={{ duration: 0.15, ease: easeOut }}
							>
								{enabledScrapers.length}
							</motion.span>
						</AnimatePresence>
						/{totalScrapers} on
					</span>
				</div>
			</Reveal>

			<div>
				{scrapersData?.scrapers.map((scraper, i) => {
					const enabled = enabledScrapers.includes(scraper.id);
					return (
						<motion.button
							key={scraper.id}
							type="button"
							onClick={() => toggleScraper(scraper.id)}
							className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-4 border-border/60 border-b px-2 py-3 text-left transition-colors last:border-0 hover:bg-muted/30"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05 + i * 0.05, duration: 0.25, ease: easeOut }}
						>
							<div className="min-w-0">
								<div
									className={`font-medium text-sm transition-colors ${
										enabled ? "text-foreground" : "text-muted-foreground"
									}`}
								>
									{scraper.name}
								</div>
								{scraper.description && (
									<div className="mt-0.5 text-muted-foreground/70 text-xs">
										{scraper.description}
									</div>
								)}
							</div>
							<Switch
								checked={enabled}
								onCheckedChange={() => toggleScraper(scraper.id)}
								onClick={(e) => e.stopPropagation()}
								className="shrink-0"
							/>
						</motion.button>
					);
				})}
			</div>

			<Reveal delay={0.2}>
				<div className="flex items-center gap-2 pt-2">
					<div className="flex-1" />
					<Button
						variant="ghost"
						size="sm"
						onClick={onSkip}
						className="rounded-none font-mono text-muted-foreground text-xs"
					>
						Skip
					</Button>
					<Button
						onClick={() => updateScrapersMutation.mutate({ enabledScrapers })}
						size="sm"
						disabled={updateScrapersMutation.isPending}
						className="group min-w-24 gap-1.5 rounded-none font-mono text-xs transition-transform active:scale-[0.98]"
					>
						{updateScrapersMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								Continue
								<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
							</>
						)}
					</Button>
				</div>
			</Reveal>
		</div>
	);
}

function FlareSolverrStep({
	onComplete,
	onSkip,
	onBack,
	isFinishing,
}: {
	onComplete: () => void;
	onSkip: () => void;
	onBack: () => void;
	isFinishing: boolean;
}) {
	const [url, setUrl] = useState("http://localhost:8191");
	const [checkResult, setCheckResult] = useState<{
		success: boolean;
		message: string;
		version?: string;
	} | null>(null);
	// Bumped on every failed check so the button replays its shake
	const [failedChecks, setFailedChecks] = useState(0);

	const checkMutation = useMutation({
		mutationFn: async (testUrl: string) => {
			return await client.setup.checkFlareSolverr({ url: testUrl });
		},
		onSuccess: (data) => {
			setCheckResult(data);
			if (!data.success) setFailedChecks((n) => n + 1);
		},
		onError: (error) => {
			setCheckResult({
				success: false,
				message: error.message || "Failed to reach FlareSolverr",
			});
			setFailedChecks((n) => n + 1);
		},
	});

	const testState: "idle" | "testing" | "online" | "offline" =
		checkMutation.isPending
			? "testing"
			: checkResult
				? checkResult.success
					? "online"
					: "offline"
				: "idle";

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

	const busy = checkMutation.isPending || updateMutation.isPending || isFinishing;

	return (
		<div className="space-y-6">
			<Reveal>
				<p className="text-muted-foreground text-sm leading-relaxed">
					FlareSolverr helps bypass Cloudflare protection on some torrent
					sites. This is optional — you can skip and configure it later.
				</p>
			</Reveal>

			<div className="space-y-3">
				<Reveal delay={0.08}>
					<div className="space-y-1.5">
						<Label
							htmlFor="flaresolverr-url"
							className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
						>
							Instance URL
						</Label>
						<div className="flex gap-2">
							<Input
								id="flaresolverr-url"
								value={url}
								onChange={(e) => {
									setUrl(e.target.value);
									setCheckResult(null);
								}}
								placeholder="http://localhost:8191"
								disabled={busy}
								className="h-10 rounded-none font-mono text-sm transition-colors focus-visible:border-primary/50 focus-visible:ring-0"
							/>
							{/* Test button doubles as the connection status indicator */}
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<motion.button
											key={failedChecks}
											type="button"
											onClick={() => checkMutation.mutate(url)}
											disabled={busy}
											animate={
												testState === "offline"
													? { x: [0, -5, 5, -3, 3, 0] }
													: { x: 0 }
											}
											transition={{ duration: 0.4, ease: easeOut }}
											whileTap={{ scale: 0.96 }}
											className={`group relative h-10 min-w-24 shrink-0 cursor-pointer border px-3 font-mono text-xs transition-colors disabled:pointer-events-none disabled:opacity-60 ${
												testState === "online"
													? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
													: testState === "offline"
														? "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
														: "border-input text-foreground hover:bg-muted/50"
											}`}
										>
											<span className="relative flex h-full items-center justify-center overflow-hidden">
												<AnimatePresence mode="popLayout" initial={false}>
													<motion.span
														key={testState}
														className="flex items-center justify-center gap-1.5"
														initial={{ y: 10, opacity: 0 }}
														animate={{ y: 0, opacity: 1 }}
														exit={{ y: -10, opacity: 0 }}
														transition={{ duration: 0.15, ease: easeOut }}
													>
														{testState === "idle" && "Test"}
														{testState === "testing" && (
															<>
																<Loader2 className="size-3.5 animate-spin" />
																testing
															</>
														)}
														{testState === "online" && (
															<>
																<span className="relative flex size-1.5">
																	<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
																	<span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
																</span>
																online
															</>
														)}
														{testState === "offline" && (
															<>
																<span className="size-1.5 rounded-full bg-amber-500" />
																<span className="group-hover:hidden">
																	offline
																</span>
																<span className="hidden group-hover:inline">
																	retry
																</span>
															</>
														)}
													</motion.span>
												</AnimatePresence>
											</span>

											{/* One-shot ping ring when the instance comes online */}
											<AnimatePresence>
												{testState === "online" && (
													<motion.span
														className="pointer-events-none absolute inset-0 border border-emerald-500/70"
														initial={{ opacity: 1, scale: 1 }}
														animate={{ opacity: 0, scale: 1.3 }}
														exit={{ opacity: 0 }}
														transition={{ duration: 0.7, ease: "easeOut" }}
													/>
												)}
											</AnimatePresence>
										</motion.button>
									</TooltipTrigger>
									{testState === "offline" && checkResult && (
										<TooltipContent side="top" className="font-mono">
											{checkResult.message}
										</TooltipContent>
									)}
									{testState === "online" && checkResult?.version && (
										<TooltipContent side="top" className="font-mono">
											flaresolverr v{checkResult.version}
										</TooltipContent>
									)}
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
				</Reveal>

			</div>

			<Reveal delay={0.15}>
				<div className="flex items-center gap-2 pt-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={onBack}
						disabled={busy}
						className="rounded-none font-mono text-muted-foreground text-xs"
					>
						Back
					</Button>
					<div className="flex-1" />
					<Button
						variant="ghost"
						size="sm"
						onClick={onSkip}
						disabled={busy}
						className="rounded-none font-mono text-muted-foreground text-xs"
					>
						Skip
					</Button>
					<Button
						onClick={() => updateMutation.mutate(url)}
						size="sm"
						disabled={busy}
						className="min-w-24 rounded-none font-mono text-xs transition-transform active:scale-[0.98]"
					>
						{updateMutation.isPending || isFinishing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Finish"
						)}
					</Button>
				</div>
			</Reveal>
		</div>
	);
}
