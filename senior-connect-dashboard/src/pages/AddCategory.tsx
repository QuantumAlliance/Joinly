/**
 * Add Category — `Dashboard figma design/Users-4.svg`.
 *
 * Reuses the Categories topbar and heading block. The form panel is drawn on
 * the page fill with a 1px outline rather than as a white card.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateCategoryMutation, useGetCategoriesQuery } from '../app/api/apiSlice';
import CategoriesHeading from '../components/CategoriesChrome';
import useCategoriesTopbar from '../components/useCategoriesTopbar';

export default function AddCategory() {
  useCategoriesTopbar();

  const navigate = useNavigate();
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data } = useGetCategoriesQuery({ page: 1, limit: 5 });
  const [createCategory, { isLoading }] = useCreateCategoryMutation();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      setError('Category name is required.');
      return;
    }
    try {
      await createCategory({ categoryName: trimmed }).unwrap();
      navigate('/categories');
    } catch {
      setError('Could not create the category. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <CategoriesHeading title="Add Category" stats={data?.data.stats} />

      <form
        onSubmit={handleSubmit}
        className="rounded-card border border-line bg-page p-6"
        noValidate
      >
        <label htmlFor="categoryName" className="block text-sm font-medium text-ink-strong">
          Category Name
        </label>
        <input
          id="categoryName"
          value={categoryName}
          onChange={(event) => {
            setCategoryName(event.target.value);
            setError(null);
          }}
          placeholder="e.g. Outdoor Gardening"
          className="mt-2 h-11 w-full rounded-lg border border-line bg-card px-4 text-base text-body outline-none focus:border-brand"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-8 flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="h-[52px] w-[253px] rounded-field bg-brand-tint text-base font-medium text-brand"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-[52px] w-[253px] rounded-field bg-action text-base font-medium text-white hover:bg-action-hover disabled:opacity-60"
          >
            {isLoading ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
