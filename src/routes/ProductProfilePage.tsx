import { useParams } from "react-router-dom";

export default function ProductProfilePage() {
  const { productId } = useParams<{ productId: string }>();
  return <div>Product profile coming soon (ID: {productId})</div>;
}
