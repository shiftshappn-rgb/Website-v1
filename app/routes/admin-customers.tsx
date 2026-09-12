import { useMemo } from "react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import type { Route } from "./+types/admin-customers";
import { AdminDataTable } from "~/components/admin/AdminDataTable";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Badge } from "~/components/ui/shadcn-badge";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  marketingOptIn: boolean;
  orderCount: number;
  createdAt: string;
};

const searchFilterFn: FilterFn<CustomerRow> = (row, _columnId, filterValue) => {
  const haystack = `${row.original.name ?? ""} ${row.original.email}`.toLowerCase();
  return haystack.includes(String(filterValue ?? "").toLowerCase());
};

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const customers = await db.customer.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    customers: customers.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      marketingOptIn: c.marketingOptIn,
      orderCount: c._count.orders,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export default function AdminCustomers({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { customers } = loaderData;

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name ?? "—"}</span>
        ),
        filterFn: searchFilterFn,
        enableHiding: false,
        size: 180,
      },
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => (
          <span className="max-w-56 truncate block">{row.original.email}</span>
        ),
        size: 220,
      },
      {
        header: "Orders",
        accessorKey: "orderCount",
        size: 90,
      },
      {
        header: "Marketing",
        accessorKey: "marketingOptIn",
        cell: ({ row }) => (
          <Badge variant={row.original.marketingOptIn ? "default" : "secondary"}>
            {row.original.marketingOptIn ? "Yes" : "No"}
          </Badge>
        ),
        size: 110,
      },
      {
        header: "Joined",
        accessorKey: "createdAt",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
        size: 120,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {customers.length} customer{customers.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <AdminDataTable
        data={customers}
        columns={columns}
        getRowId={(row) => row.id}
        searchColumnId="name"
        searchPlaceholder="Filter by name or email..."
        emptyMessage="No customers yet."
      />
    </div>
  );
}
