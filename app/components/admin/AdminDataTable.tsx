import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleX,
  Columns3,
  Ellipsis,
  Filter,
  ListFilter,
  Trash,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/shadcn-button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/shadcn-input";
import { Label } from "~/components/ui/label";
import { Pagination, PaginationContent, PaginationItem } from "~/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

export type AdminDataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId: (row: TData) => string;
  searchColumnId?: string;
  searchPlaceholder?: string;
  facetColumnId?: string;
  facetLabel?: string;
  facetLabels?: Record<string, string>;
  emptyMessage?: string;
  enableRowSelection?: boolean;
  toolbarEnd?: ReactNode;
  onDeleteSelected?: (rows: TData[]) => void;
  deletingSelected?: boolean;
  deleteSelectedLabel?: string;
  deleteSelectedDescription?: string;
};

export function AdminDataTable<TData>({
  data,
  columns,
  getRowId,
  searchColumnId,
  searchPlaceholder = "Filter...",
  facetColumnId,
  facetLabel = "Status",
  facetLabels,
  emptyMessage = "No results.",
  enableRowSelection = false,
  toolbarEnd,
  onDeleteSelected,
  deletingSelected = false,
  deleteSelectedLabel = "Delete selected?",
  deleteSelectedDescription = "This action cannot be undone.",
}: AdminDataTableProps<TData>) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const selectionColumn = useMemo<ColumnDef<TData, unknown>>(
    () => ({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 28,
      enableSorting: false,
      enableHiding: false,
    }),
    []
  );

  const tableColumns = useMemo(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableRowSelection, selectionColumn]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const uniqueFacetValues = useMemo(() => {
    if (!facetColumnId) return [];
    const column = table.getColumn(facetColumnId);
    if (!column) return [];
    return Array.from(column.getFacetedUniqueValues().keys()).sort() as string[];
  }, [facetColumnId, table.getColumn(facetColumnId)?.getFacetedUniqueValues()]);

  const facetCounts = useMemo(() => {
    if (!facetColumnId) return new Map<string, number>();
    const column = table.getColumn(facetColumnId);
    if (!column) return new Map<string, number>();
    return column.getFacetedUniqueValues();
  }, [facetColumnId, table.getColumn(facetColumnId)?.getFacetedUniqueValues()]);

  const selectedFacetValues = useMemo(() => {
    if (!facetColumnId) return [];
    return (table.getColumn(facetColumnId)?.getFilterValue() as string[] | undefined) ?? [];
  }, [facetColumnId, table.getColumn(facetColumnId)?.getFilterValue()]);

  function handleFacetChange(checked: boolean, value: string) {
    if (!facetColumnId) return;
    const current =
      (table.getColumn(facetColumnId)?.getFilterValue() as string[] | undefined) ?? [];
    const next = [...current];
    if (checked) next.push(value);
    else {
      const index = next.indexOf(value);
      if (index > -1) next.splice(index, 1);
    }
    table.getColumn(facetColumnId)?.setFilterValue(next.length ? next : undefined);
  }

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {searchColumnId && (
            <div className="relative">
              <Input
                id={`${id}-search`}
                ref={inputRef}
                className={cn(
                  "peer min-w-60 ps-9",
                  Boolean(table.getColumn(searchColumnId)?.getFilterValue()) && "pe-9"
                )}
                value={(table.getColumn(searchColumnId)?.getFilterValue() ?? "") as string}
                onChange={(e) =>
                  table.getColumn(searchColumnId)?.setFilterValue(e.target.value)
                }
                placeholder={searchPlaceholder}
                type="text"
                aria-label={searchPlaceholder}
              />
              <div className="pointer-events-none absolute inset-y-0 inset-s-0 flex items-center justify-center ps-3 text-muted-foreground/80">
                <ListFilter size={16} strokeWidth={2} aria-hidden />
              </div>
              {Boolean(table.getColumn(searchColumnId)?.getFilterValue()) && (
                <button
                  type="button"
                  className="absolute inset-y-0 inset-e-0 flex h-full w-9 items-center justify-center rounded-e-lg text-muted-foreground/80 outline-offset-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring/70"
                  aria-label="Clear filter"
                  onClick={() => {
                    table.getColumn(searchColumnId)?.setFilterValue("");
                    inputRef.current?.focus();
                  }}
                >
                  <CircleX size={16} strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
          )}

          {facetColumnId && (
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline">
                  <Filter
                    className="-ms-1 me-2 opacity-60"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {facetLabel}
                  {selectedFacetValues.length > 0 && (
                    <span className="-me-1 ms-3 inline-flex h-5 items-center rounded border border-border bg-background px-1 text-[0.625rem] font-medium text-muted-foreground/70">
                      {selectedFacetValues.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="min-w-36 p-3" align="start">
                <div className="flex flex-col gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Filters</div>
                  <div className="flex flex-col gap-3">
                    {uniqueFacetValues.map((value, i) => (
                      <div key={value} className="flex items-center gap-2">
                        <Checkbox
                          id={`${id}-facet-${i}`}
                          checked={selectedFacetValues.includes(value)}
                          onCheckedChange={(checked: boolean) =>
                            handleFacetChange(checked, value)
                          }
                        />
                        <Label
                          htmlFor={`${id}-facet-${i}`}
                          className="flex grow justify-between gap-2 font-normal"
                        >
                          {facetLabels?.[value] ?? value}
                          <span className="ms-2 text-xs text-muted-foreground">
                            {facetCounts.get(value)}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Columns3
                  className="-ms-1 me-2 opacity-60"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-100">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {enableRowSelection && onDeleteSelected && selectedCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline">
                  <Trash
                    className="-ms-1 me-2 opacity-60"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Delete
                  <span className="-me-1 ms-3 inline-flex h-5 items-center rounded border border-border bg-background px-1 text-[0.625rem] font-medium text-muted-foreground/70">
                    {selectedCount}
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
                    aria-hidden
                  >
                    <CircleAlert className="opacity-80" size={16} strokeWidth={2} />
                  </div>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{deleteSelectedLabel}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {deleteSelectedDescription}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deletingSelected}
                    onClick={() =>
                      onDeleteSelected(selectedRows.map((row) => row.original))
                    }
                  >
                    {deletingSelected ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {toolbarEnd}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() ? `${header.getSize()}px` : undefined }}
                    className="h-11"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex h-full w-full cursor-pointer items-center justify-between gap-2 select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: (
                            <ChevronUp
                              className="shrink-0 opacity-60"
                              size={16}
                              strokeWidth={2}
                              aria-hidden
                            />
                          ),
                          desc: (
                            <ChevronDown
                              className="shrink-0 opacity-60"
                              size={16}
                              strokeWidth={2}
                              aria-hidden
                            />
                          ),
                        }[header.column.getIsSorted() as string] ?? null}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor={`${id}-page-size`} className="max-sm:sr-only">
            Rows per page
          </Label>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger id={`${id}-page-size`} className="w-fit whitespace-nowrap">
              <SelectValue placeholder="Select number of results" />
            </SelectTrigger>
            <SelectContent className="z-100">
              {[5, 10, 25, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={pageSize.toString()}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex grow justify-end whitespace-nowrap text-sm text-muted-foreground">
          <p aria-live="polite">
            <span className="text-foreground">
              {table.getRowCount() === 0
                ? 0
                : table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                  1}
              -
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                table.getRowCount()
              )}
            </span>{" "}
            of <span className="text-foreground">{table.getRowCount()}</span>
          </p>
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.firstPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Go to first page"
              >
                <ChevronFirst size={16} strokeWidth={2} aria-hidden />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Go to previous page"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Go to next page"
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.lastPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Go to last page"
              >
                <ChevronLast size={16} strokeWidth={2} aria-hidden />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

export function AdminRowActions({
  items,
}: {
  items: Array<{
    label: string;
    href?: string;
    onSelect?: () => void;
    destructive?: boolean;
    external?: boolean;
  }>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shadow-none"
          aria-label="Open actions"
        >
          <Ellipsis size={16} strokeWidth={2} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-100">
        {items.map((item) =>
          item.href ? (
            <DropdownMenuItem key={item.label} asChild>
              <a
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                className={cn(item.destructive && "text-destructive focus:text-destructive")}
              >
                {item.label}
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={item.label}
              className={cn(item.destructive && "text-destructive focus:text-destructive")}
              onSelect={() => item.onSelect?.()}
            >
              {item.label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
