import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";

export default function ProductsListPage() {
  const products = useQuery(api.products.listWithProfiles);

  if (!products) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-lg font-medium text-gray-900">Products</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Package className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No products yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-lg font-medium text-gray-900">Products</h1>
      <div className="space-y-3">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({
  product,
}: {
  product: {
    _id: Id<"products">;
    name: string;
    url: string;
    profile: {
      completeness: number;
      overallConfidence: number;
      hasConvergence: boolean;
      hasOutputs: boolean;
    } | null;
  };
}) {
  const completeness = Math.round((product.profile?.completeness ?? 0) * 100);

  return (
    <Link
      to={`/products/${product._id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-900">
            {product.name}
          </span>
          <span className="ml-2 text-sm text-gray-500">{product.url}</span>
        </div>
        <div className="flex items-center gap-2">
          {product.profile?.hasConvergence && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              Convergence
            </span>
          )}
          {product.profile?.hasOutputs && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Outputs
            </span>
          )}
          <span className="text-sm text-gray-500">{completeness}%</span>
        </div>
      </div>
    </Link>
  );
}
