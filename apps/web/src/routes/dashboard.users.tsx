import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/users")({
	component: UsersPage,
});

type AdminUser = Awaited<ReturnType<typeof client.users.list>>["users"][number];

function UsersPage() {
	const users = useQuery(orpc.users.list.queryOptions());
	const { data: session } = authClient.useSession();
	const meId = session?.user.id;

	const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
	const [pending, setPending] = useState(false);

	async function setRole(u: AdminUser, role: "admin" | "user") {
		try {
			await client.users.setRole({ userId: u.id, role });
			toast.success(`${u.name} is now ${role}`);
			users.refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update role");
		}
	}

	async function setBanned(u: AdminUser, banned: boolean) {
		setPending(true);
		try {
			await client.users.setBanned({ userId: u.id, banned });
			toast.success(banned ? `${u.name} banned` : `${u.name} unbanned`);
			setBanTarget(null);
			users.refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update user");
		} finally {
			setPending(false);
		}
	}

	return (
		<div>
			<PageHeader
				title="Users"
				description="Manage accounts that can sign in to Minato, their roles, and access."
			/>

			{users.isLoading && (
				<div className="h-48 animate-pulse rounded-xl border border-border bg-muted/30" />
			)}

			{users.data && (
				<div className="overflow-hidden rounded-xl border border-border bg-card">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead>User</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Joined</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{users.data.users.map((u) => {
								const isAdmin = u.role === "admin";
								const isSelf = u.id === meId;
								return (
									<TableRow key={u.id}>
										<TableCell>
											<div className="flex flex-col">
												<span className="font-medium text-foreground">
													{u.name}
													{isSelf && (
														<span className="ml-2 font-normal text-muted-foreground text-xs">
															(you)
														</span>
													)}
												</span>
												<span className="text-muted-foreground text-xs">
													{u.email}
												</span>
											</div>
										</TableCell>
										<TableCell>
											{isAdmin ? (
												<StatusPill tone="info">Admin</StatusPill>
											) : (
												<StatusPill tone="neutral">User</StatusPill>
											)}
										</TableCell>
										<TableCell>
											{u.banned ? (
												<StatusPill tone="danger" dot>
													Banned
												</StatusPill>
											) : (
												<StatusPill tone="success" dot>
													Active
												</StatusPill>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{new Date(u.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-right">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														disabled={isSelf}
														className="text-muted-foreground"
													>
														<MoreHorizontal className="size-4" />
														<span className="sr-only">Actions</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-44">
													{isAdmin ? (
														<DropdownMenuItem
															onClick={() => setRole(u, "user")}
														>
															<UserCog className="size-4" />
															Demote to user
														</DropdownMenuItem>
													) : (
														<DropdownMenuItem
															onClick={() => setRole(u, "admin")}
														>
															<ShieldCheck className="size-4" />
															Promote to admin
														</DropdownMenuItem>
													)}
													<DropdownMenuSeparator />
													{u.banned ? (
														<DropdownMenuItem
															onClick={() => setBanned(u, false)}
														>
															<ShieldCheck className="size-4" />
															Unban
														</DropdownMenuItem>
													) : (
														<DropdownMenuItem
															variant="destructive"
															onClick={() => setBanTarget(u)}
														>
															<ShieldOff className="size-4" />
															Ban user
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			<ConfirmDialog
				open={banTarget !== null}
				onOpenChange={(o) => !o && setBanTarget(null)}
				title={`Ban ${banTarget?.name ?? "user"}?`}
				description="They will be signed out and blocked from signing in until unbanned."
				confirmLabel="Ban user"
				destructive
				loading={pending}
				onConfirm={() => banTarget && setBanned(banTarget, true)}
			/>
		</div>
	);
}
