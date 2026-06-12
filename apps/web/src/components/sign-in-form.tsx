import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function SignInForm() {
	const navigate = useNavigate();
	const [passkeyPending, setPasskeyPending] = useState(false);

	async function signInWithPasskey() {
		setPasskeyPending(true);
		await authClient.signIn.passkey({
			fetchOptions: {
				onSuccess: () => {
					toast.success("Welcome back");
					navigate({ to: "/dashboard" });
				},
				onError: (ctx: { error: { message?: string } }) => {
					toast.error(ctx.error.message || "Passkey sign-in failed");
				},
			},
		});
		setPasskeyPending(false);
	}

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{ email: value.email, password: value.password },
				{
					onSuccess: () => {
						toast.success("Welcome back");
						navigate({ to: "/dashboard" });
					},
					onError: (error: { error: { message?: string; statusText?: string } }) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Enter a valid email address"),
				password: z.string().min(1, "Password is required"),
			}),
		},
	});

	return (
		<div className="space-y-5">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-5"
			>
				<form.Field name="email">
					{(field) => (
						<div className="space-y-1.5">
							<Label
								htmlFor={field.name}
								className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
							>
								Email
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								autoComplete="email"
								autoFocus
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="admin@example.com"
								className="h-11"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-destructive text-xs">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) => (
						<div className="space-y-1.5">
							<Label
								htmlFor={field.name}
								className="font-mono font-medium text-[10px] text-muted-foreground/60 uppercase tracking-widest"
							>
								Password
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								autoComplete="current-password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="••••••••"
								className="h-11"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-destructive text-xs">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Subscribe>
					{(state) => (
						<Button
							type="submit"
							className="h-11 w-full"
							disabled={!state.canSubmit || state.isSubmitting || passkeyPending}
						>
							{state.isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								"Sign in"
							)}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="relative flex items-center gap-3">
				<div className="h-px flex-1 bg-border" />
				<span className="text-muted-foreground text-xs">or</span>
				<div className="h-px flex-1 bg-border" />
			</div>

			<Button
				type="button"
				variant="outline"
				className="h-11 w-full gap-2"
				onClick={signInWithPasskey}
				disabled={passkeyPending}
			>
				{passkeyPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Fingerprint className="size-4" />
				)}
				Sign in with passkey
			</Button>
		</div>
	);
}
