import { useMemo } from "react";
import { Link } from "react-router";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { BlogStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import type { Route } from "./+types/admin-blog-index";
import { AdminDataTable, AdminRowActions } from "~/components/admin/AdminDataTable";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Badge } from "~/components/ui/shadcn-badge";
import { Button } from "~/components/ui/shadcn-button";
import { LinkButton } from "~/components/ui/Button";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  status: BlogStatus;
  author: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

const searchFilterFn: FilterFn<BlogRow> = (row, _columnId, filterValue) => {
  const haystack = `${row.original.title} ${row.original.slug}`.toLowerCase();
  return haystack.includes(String(filterValue ?? "").toLowerCase());
};

const statusFilterFn: FilterFn<BlogRow> = (row, columnId, filterValue: string[]) => {
  if (!filterValue?.length) return true;
  return filterValue.includes(row.getValue(columnId) as string);
};

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const posts = await db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      author: p.author,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

export default function AdminBlogIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { posts } = loaderData;

  const columns = useMemo<ColumnDef<BlogRow>[]>(
    () => [
      {
        header: "Title",
        accessorKey: "title",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title}</div>
            <div className="max-w-40 truncate text-xs text-muted-foreground">
              {row.original.slug}
            </div>
          </div>
        ),
        filterFn: searchFilterFn,
        enableHiding: false,
        size: 260,
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "published" ? "default" : "secondary"}>
            {row.original.status}
          </Badge>
        ),
        filterFn: statusFilterFn,
        size: 120,
      },
      {
        header: "Author",
        accessorKey: "author",
        cell: ({ row }) => row.original.author ?? "—",
        size: 140,
      },
      {
        header: "Published",
        accessorKey: "publishedAt",
        cell: ({ row }) =>
          row.original.publishedAt
            ? new Date(row.original.publishedAt).toLocaleDateString()
            : "—",
        size: 120,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AdminRowActions
              items={[{ label: "Edit", href: `/admin/blog/${row.original.id}` }]}
            />
          </div>
        ),
        size: 60,
        enableSorting: false,
        enableHiding: false,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl text-navy">Blog</h1>
        <LinkButton href="/admin/blog/new">New Post</LinkButton>
      </div>
      <AdminDataTable
        data={posts}
        columns={columns}
        getRowId={(row) => row.id}
        searchColumnId="title"
        searchPlaceholder="Filter by title or slug..."
        facetColumnId="status"
        facetLabel="Status"
        emptyMessage="No blog posts yet."
        toolbarEnd={
          <Button asChild variant="outline">
            <Link to="/admin/blog/new">
              <Plus className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden />
              New post
            </Link>
          </Button>
        }
      />
    </div>
  );
}
