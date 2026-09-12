import { useMemo } from "react";
import { Link } from "react-router";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { Route } from "./+types/admin-orders-index";
import type { OrderStatus } from "@prisma/client";
import { AdminDataTable, AdminRowActions } from "~/components/admin/AdminDataTable";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Badge } from "~/components/ui/shadcn-badge";
import { db, isDatabaseAvailable } from "~/db.server";
import { formatCurrency } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";

type OrderRow = {
  id: string;
  orderNumber: string;
  email: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
};

const statusFilterFn: FilterFn<OrderRow> = (row, columnId, filterValue: string[]) => {
  if (!filterValue?.length) return true;
  return filterValue.includes(row.getValue(columnId) as string);
};

const searchFilterFn: FilterFn<OrderRow> = (row, _columnId, filterValue) => {
  const haystack = `${row.original.orderNumber} ${row.original.email}`.toLowerCase();
  return haystack.includes(String(filterValue ?? "").toLowerCase());
};

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const orders = await db.order.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    dbAvailable: true as const,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      email: o.email,
      status: o.status,
      total: Number(o.total),
      itemCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export default function AdminOrdersIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { orders } = loaderData;

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        header: "Order",
        accessorKey: "orderNumber",
        cell: ({ row }) => (
          <Link
            to={`/admin/orders/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
        filterFn: searchFilterFn,
        enableHiding: false,
        size: 160,
      },
      {
        header: "Customer",
        accessorKey: "email",
        cell: ({ row }) => (
          <span className="max-w-48 truncate block">{row.original.email}</span>
        ),
        size: 200,
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "fulfilled" ? "default" : "secondary"}>
            {row.original.status}
          </Badge>
        ),
        filterFn: statusFilterFn,
        size: 120,
      },
      {
        header: "Items",
        accessorKey: "itemCount",
        size: 80,
      },
      {
        header: "Total",
        accessorKey: "total",
        cell: ({ row }) => formatCurrency(row.original.total),
        size: 110,
      },
      {
        header: "Date",
        accessorKey: "createdAt",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
        size: 120,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AdminRowActions
              items={[{ label: "View order", href: `/admin/orders/${row.original.id}` }]}
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
      <h1 className="font-serif text-2xl text-navy">Orders</h1>
      <AdminDataTable
        data={orders}
        columns={columns}
        getRowId={(row) => row.id}
        searchColumnId="orderNumber"
        searchPlaceholder="Filter by order # or email..."
        facetColumnId="status"
        facetLabel="Status"
        emptyMessage="No orders found."
      />
    </div>
  );
}
