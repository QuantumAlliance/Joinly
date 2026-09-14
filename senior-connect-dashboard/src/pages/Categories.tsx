/**
 * Categories — `Dashboard figma design/Users-2.svg`.
 *
 * "Add Category" lives in the topbar; the two count chips sit level with the
 * page heading. The table header is a #F2F4F2 band whose column labels carry
 * their own short underlines.
 */
import { useState } from 'react';
import { useGetCategoriesQuery } from '../app/api/apiSlice';
import ApiError from '../components/ApiError';
import CategoriesHeading from '../components/CategoriesChrome';
import useCategoriesTopbar from '../components/useCategoriesTopbar';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';

const PAGE_SIZE = 5;

const TH = 'px-0 py-4 text-left text-base font-normal text-body';

export default function Categories() {
  useCategoriesTopbar();

  const [page, setPage] = useState(1);
  const { data, isError, refetch } = useGetCategoriesQuery({ page, limit: PAGE_SIZE });

  const stats = data?.data.stats;
  const categories = data?.data.categories ?? [];
  const meta = data?.meta;
  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div className="space-y-6">
      <CategoriesHeading title="Activity Categories" stats={stats} />

      <section className="overflow-hidden rounded-card bg-card shadow-card">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[25%]" />
            <col />
          </colgroup>
          <thead className="bg-head-bg">
            <tr>
              <th className={`${TH} pl-6`}>
                <span className="block border-b border-field pb-4">Category Name</span>
              </th>
              <th className={`${TH} text-center`}>
                <span className="block border-b border-field pb-4">Activity Count</span>
              </th>
              <th className={TH}>
                <span className="block border-b border-field pb-4">Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isError && (
              <tr>
                <td colSpan={3}>
                  <ApiError what="categories" onRetry={() => refetch()} />
                </td>
              </tr>
            )}
            {!isError && categories.length === 0 && (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm text-muted">
                  No categories yet.
                </td>
              </tr>
            )}
            {categories.map((category) => (
              <tr key={category.id} className="h-[73px] border-b border-line last:border-0">
                <td className="pl-6 text-base text-body">{category.categoryName}</td>
                <td className="text-center text-base text-body">{category.activityCount}</td>
                <td>
                  <StatusBadge status={category.status} variant="plain" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing {from} to {to} of {meta?.total ?? 0} categories
        </p>
        <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
      </div>
    </div>
  );
}
