import { useState, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { Pagination, Empty, Checkbox } from "antd";
import { Search } from "lucide-react";

interface DataTableProps<T extends object> {
  columns: ColumnDef<T, any>[];
  data: T[];
}

const removeVietnameseTones = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

export function DataTableNoCheckbox<T extends object>({ columns, data }: DataTableProps<T>) {
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const filteredData = useMemo(() => {
    if (!globalFilter) return data;
    const normalizedFilter = removeVietnameseTones(globalFilter);
    return data.filter((row) =>
      Object.values(row).some((value) => {
        if (value === null || value === undefined) return false;
        return removeVietnameseTones(String(value)).includes(normalizedFilter);
      })
    );
  }, [data, globalFilter]);

  const tableColumns = useMemo<ColumnDef<T, any>[]>(
    () => [
      {
        id: "_select",
        header: ({ table }) => {
          const rows = table.getRowModel().rows;
          const allSelected = rows.length > 0 && rows.every((row) => selectedRowIds[row.id]);
          const someSelected = rows.some((row) => selectedRowIds[row.id]);

          return (
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              onChange={(e) => {
                const checked = e.target.checked;
                const newSelected: Record<string, boolean> = {};
                rows.forEach((row) => {
                  newSelected[row.id] = checked;
                });
                setSelectedRowIds(checked ? newSelected : {});
              }}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={selectedRowIds[row.id] ?? false}
            onChange={(e) => {
              setSelectedRowIds((prev) => ({
                ...prev,
                [row.id]: e.target.checked,
              }));
            }}
          />
        ),
        size: 50,
      },
      ...columns,
    ],
    [columns, selectedRowIds]
  );

  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="bg-white shadow-sm border border-gray-200 overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-dark-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
            placeholder="Tìm kiếm thông tin..."
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-dark uppercase bg-gray-50/80 font-semibold">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-4 border-b border-gray-200">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr 
                  key={row.id} 
                  className={`hover:bg-blue-50/30 transition-colors ${selectedRowIds[row.id] ? 'bg-blue-50/50' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={tableColumns.length} className="py-12">
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                    description={<span className="text-gray-400">Không tìm thấy dữ liệu phù hợp</span>}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modern Pagination */}
      <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-500 font-medium">
          Hiển thị {table.getRowModel().rows.length} trên tổng số {filteredData.length} kết quả
        </div>
        <Pagination
        className="text-xs text-gray-500 font-medium"
          current={pageIndex + 1}
          pageSize={pageSize}
          total={filteredData.length}
          showSizeChanger
          size="small"
          onChange={(page, size) => {
            table.setPageIndex(page - 1);
            table.setPageSize(size);
          }}
        />
      </div>
    </div>
  );
}