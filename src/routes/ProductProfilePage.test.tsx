import { expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ProductProfilePage from "./ProductProfilePage"

// Mock useParams
const mockUseParams = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useParams: () => mockUseParams(),
  }
})

// Mock Convex
const mockUseQuery = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

// Mock the api import
vi.mock("../../convex/_generated/api", () => ({
  api: {
    products: {
      get: "products:get",
    },
    productProfiles: {
      get: "productProfiles:get",
    },
  },
}))

const mockProduct = {
  _id: "product1",
  name: "Acme SaaS",
  url: "https://acme.com",
  userId: "user1",
  createdAt: 1000,
  updatedAt: 2000,
}

const mockProfile = {
  _id: "profile1",
  productId: "product1",
  completeness: 0.6,
  overallConfidence: 0.75,
  createdAt: 1000,
  updatedAt: 2000,
}

function setup() {
  render(
    <MemoryRouter>
      <ProductProfilePage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockUseParams.mockReturnValue({ productId: "product1" })
  mockUseQuery.mockReset()
})

test("reads productId from useParams and fetches product + profile data", () => {
  mockUseQuery.mockReturnValue(undefined)
  setup()

  // Verify useQuery was called with the right query names and args
  expect(mockUseQuery).toHaveBeenCalledWith("products:get", {
    id: "product1",
  })
  expect(mockUseQuery).toHaveBeenCalledWith("productProfiles:get", {
    productId: "product1",
  })
})

test("header displays product name, URL, completeness %, and confidence score", () => {
  mockUseQuery.mockImplementation((query: string) => {
    if (query === "products:get") return mockProduct
    if (query === "productProfiles:get") return mockProfile
    return undefined
  })
  setup()

  expect(screen.getByText("Acme SaaS")).toBeInTheDocument()
  expect(screen.getByText("https://acme.com")).toBeInTheDocument()
  expect(screen.getByText("60% complete")).toBeInTheDocument()
  expect(screen.getByText("75% confidence")).toBeInTheDocument()
})

test("back link navigates to /", () => {
  mockUseQuery.mockImplementation((query: string) => {
    if (query === "products:get") return mockProduct
    if (query === "productProfiles:get") return mockProfile
    return undefined
  })
  setup()

  const backLink = screen.getByRole("link", { name: /back/i })
  expect(backLink).toHaveAttribute("href", "/")
})

test("four tabs render: Value Moments, ICP Profiles, Activation Map, Measurement Spec", () => {
  mockUseQuery.mockImplementation((query: string) => {
    if (query === "products:get") return mockProduct
    if (query === "productProfiles:get") return mockProfile
    return undefined
  })
  setup()

  expect(screen.getByRole("tab", { name: "Value Moments" })).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "ICP Profiles" })).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "Activation Map" })).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "Measurement Spec" })).toBeInTheDocument()
})

test("loading state renders while data is being fetched", () => {
  mockUseQuery.mockReturnValue(undefined)
  setup()

  expect(screen.getByText("Loading product...")).toBeInTheDocument()
})

test("empty state renders when profile has no data", () => {
  mockUseQuery.mockImplementation((query: string) => {
    if (query === "products:get") return mockProduct
    if (query === "productProfiles:get") return null
    return undefined
  })
  setup()

  // Product renders with 0% stats when profile is null
  expect(screen.getByText("Acme SaaS")).toBeInTheDocument()
  expect(screen.getByText("0% complete")).toBeInTheDocument()
  expect(screen.getByText("0% confidence")).toBeInTheDocument()
})
