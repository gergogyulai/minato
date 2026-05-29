import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function SignInForm() {
	const navigate = useNavigate();

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
					onError: (error) => {
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
							className="font-medium text-muted-foreground text-xs uppercase tracking-wider"
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
							className="font-medium text-muted-foreground text-xs uppercase tracking-wider"
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
						disabled={!state.canSubmit || state.isSubmitting}
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
	);
}
