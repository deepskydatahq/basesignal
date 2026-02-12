import { useParams, Link } from "react-router-dom"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import { ValueMomentsSection } from "@/components/product-profile/ValueMomentsSection"
import { ICPProfilesSection } from "@/components/product-profile/ICPProfilesSection"
import { ActivationMapSection } from "@/components/product-profile/ActivationMapSection"
import { MeasurementSpecSection } from "@/components/product-profile/MeasurementSpecSection"
import type { ValueMoment } from "@/components/product-profile/types"
import type { ActivationMap } from "@/components/product-profile/types"
import type { ICPProfile, MeasurementSpec } from "../../convex/analysis/outputs/types"

export default function ProductProfilePage() {
  const { productId } = useParams<{ productId: string }>()

  const product = useQuery(
    api.products.get,
    productId ? { id: productId as Id<"products"> } : "skip"
  )
  const profile = useQuery(
    api.productProfiles.get,
    productId ? { productId: productId as Id<"products"> } : "skip"
  )
  const outputs = useQuery(
    api.productProfiles.getOutputs,
    productId ? { productId: productId as Id<"products"> } : "skip"
  )

  if (product === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading product...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-lg font-medium text-gray-900">Product not found</h2>
        <Link to="/" className="text-blue-600 hover:underline">
          Back to products
        </Link>
      </div>
    )
  }

  const completeness = profile?.completeness ?? 0
  const confidence = profile?.overallConfidence ?? 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
            {product.url && (
              <p className="text-sm text-gray-500 mt-1">{product.url}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {Math.round(completeness * 100)}% complete
            </Badge>
            <Badge variant="outline">
              {Math.round(confidence * 100)}% confidence
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="value-moments">
        <TabsList>
          <TabsTrigger value="value-moments">Value Moments</TabsTrigger>
          <TabsTrigger value="icp-profiles">ICP Profiles</TabsTrigger>
          <TabsTrigger value="activation-map">Activation Map</TabsTrigger>
          <TabsTrigger value="measurement-spec">Measurement Spec</TabsTrigger>
        </TabsList>

        <TabsContent value="value-moments">
          <ValueMomentsSection
            moments={((profile as Record<string, unknown>)?.convergence as { value_moments?: ValueMoment[] } | undefined)?.value_moments ?? []}
          />
        </TabsContent>

        <TabsContent value="icp-profiles">
          <ICPProfilesSection
            profiles={(outputs?.icpProfiles ?? []) as ICPProfile[]}
          />
        </TabsContent>

        <TabsContent value="activation-map">
          <ActivationMapSection
            activationMap={(outputs?.activationMap as ActivationMap | null) ?? null}
          />
        </TabsContent>

        <TabsContent value="measurement-spec">
          <MeasurementSpecSection
            measurementSpec={(outputs?.measurementSpec as MeasurementSpec | null) ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
