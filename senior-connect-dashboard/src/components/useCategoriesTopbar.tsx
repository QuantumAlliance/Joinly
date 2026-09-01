/**
 * Publishes the shared "Categories" topbar — title plus the Add Category
 * button — for both `Dashboard figma design/Users-2.svg` and `Users-4.svg`.
 */
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTopbar } from '../layouts/topbar';

/** Publishes the "Categories" topbar with its Add Category button. */
export default function useCategoriesTopbar() {
  const navigate = useNavigate();
  useTopbar(
    {
      title: 'Categories',
      variant: 'action',
      action: (
        <button
          type="button"
          onClick={() => navigate('/categories/new')}
          className="inline-flex h-9 items-center gap-2 rounded-2xl bg-action px-5 text-sm font-medium text-white hover:bg-action-hover"
        >
          <Plus size={16} />
          Add Category
        </button>
      ),
    },
    [navigate],
  );
}
