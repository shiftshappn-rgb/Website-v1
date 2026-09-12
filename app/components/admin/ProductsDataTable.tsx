import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import type { ProductStatus } from "@prisma/client";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { Plus } from "lucide-react";

import { AdminDataTable, AdminRowActions } from "~/components/admin/AdminDataTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/shadcn-badge";
import { Button } from "~/components/ui/shadcn-button";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { cn, formatCurrency } from "~/lib/utils";

export type ProductTableItem = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  basePrice: number;
  categoryName: string | null;
  variantCount: number;
  thumbnailPublicId: string | null;
  thumbnailAlt: string;
};

type ActionResult = { error?: string; success?: string };

const statusLabel: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Inactive",
};

const multiColumnFilterFn: FilterFn<ProductTableItem> = (row, _columnId, filterValue) => {
  const searchableRowContent = `${row.original.name} ${row.original.slug}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const statusFilterFn: FilterFn<ProductTableItem> = (row, columnId, filterValue: string[]) => {
  if (!filterValue?.length) return true;
  const status = row.getValue(columnId) as string;
  return filterValue.includes(status);
};

function StatusToggle({ product }: { product: ProductTableItem }) {
  const fetcher = useFetcher<ActionResult>();
  const isActive = product.status === "active";
  const pending = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-status" />
      <input type="hidden" name="productId" value={product.id} />
      <button
        type="submit"
        disabled={pending}
        role="switch"
        aria-checked={isActive}
        aria-label={isActive ? `Deactivate ${product.name}` : `Activate ${product.name}`}
        className={cn(
          "relative h-7 w-12 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
          isActive ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
            isActive && "translate-x-5"
          )}
        />
      </button>
    </fetcher.Form>
  );
}

export function ProductsDataTable({
  products,
  cloudName,
}: {
  products: ProductTableItem[];
  cloudName: string | null;
}) {
  const deleteFetcher = useFetcher<ActionResult>();
  const bulkFetcher = useFetcher<ActionResult>();
  const [pendingDelete, setPendingDelete] = useState<ProductTableItem | null>(null);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      setPendingDelete(null);
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  const columns = useMemo<ColumnDef<ProductTableItem>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => {
          const thumbnailSrc = cloudinaryImageUrl(
            row.original.thumbnailPublicId ?? "",
            cloudName,
            80
          );
          return (
            <div className="flex items-center gap-3">
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={row.original.thumbnailAlt}
                  className="size-10 rounded-md object-cover"
                />
              ) : (
                <div className="size-10 rounded-md bg-muted" aria-hidden />
              )}
              <div>
                <div className="font-medium">{row.getValue("name")}</div>
                <div className="max-w-40 truncate text-xs text-muted-foreground">
                  {row.original.slug}
                </div>
              </div>
            </div>
          );
        },
        size: 260,
        filterFn: multiColumnFilterFn,
        enableHiding: false,
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const status = row.getValue("status") as ProductStatus;
          return (
            <Badge
              variant={status === "active" ? "default" : "secondary"}
              className={cn(
                status === "archived" && "bg-muted-foreground/60 text-primary-foreground"
              )}
            >
              {statusLabel[status]}
            </Badge>
          );
        },
        size: 110,
        filterFn: statusFilterFn,
      },
      {
        id: "active",
        header: "Active",
        cell: ({ row }) => <StatusToggle product={row.original} />,
        size: 90,
        enableSorting: false,
      },
      {
        header: "Price",
        accessorKey: "basePrice",
        cell: ({ row }) => formatCurrency(row.getValue("basePrice")),
        size: 110,
      },
      {
        header: "Category",
        accessorKey: "categoryName",
        cell: ({ row }) => row.original.categoryName ?? "—",
        size: 140,
      },
      {
        header: "Variants",
        accessorKey: "variantCount",
        size: 90,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AdminRowActions
              items={[
                { label: "Edit", href: `/admin/products/${row.original.id}` },
                {
                  label: "View storefront",
                  href: `/products/${row.original.slug}`,
                  external: true,
                },
                {
                  label: "Delete",
                  destructive: true,
                  onSelect: () => setPendingDelete(row.original),
                },
              ]}
            />
          </div>
        ),
        size: 60,
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [cloudName]
  );

  const deleting = deleteFetcher.state !== "idle";
  const bulkDeleting = bulkFetcher.state !== "idle";

  return (
    <>
      <AdminDataTable
        data={products}
        columns={columns}
        getRowId={(row) => row.id}
        searchColumnId="name"
        searchPlaceholder="Filter by name or slug..."
        facetColumnId="status"
        facetLabel="Status"
        facetLabels={statusLabel}
        emptyMessage="No products found."
        enableRowSelection
        deletingSelected={bulkDeleting}
        deleteSelectedLabel="Delete selected products?"
        deleteSelectedDescription="This cannot be undone. Products with order history will be skipped."
        onDeleteSelected={(rows) => {
          const formData = new FormData();
          formData.set("intent", "bulk-delete");
          for (const row of rows) formData.append("productIds", row.id);
          bulkFetcher.submit(formData, { method: "post" });
        }}
        toolbarEnd={
          <Button asChild variant="outline">
            <Link to="/admin/products/new">
              <Plus className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden />
              New product
            </Link>
          </Button>
        }
      />

      {(bulkFetcher.data?.error || deleteFetcher.data?.error) && !pendingDelete && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {bulkFetcher.data?.error || deleteFetcher.data?.error}
        </p>
      )}

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{pendingDelete?.name}</span> and
              its variants. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteFetcher.data?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteFetcher.data.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !pendingDelete}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingDelete) return;
                const formData = new FormData();
                formData.set("intent", "delete");
                formData.set("productId", pendingDelete.id);
                deleteFetcher.submit(formData, { method: "post" });
              }}
            >
              {deleting ? "Deleting…" : "Delete product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
