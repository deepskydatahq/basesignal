import type {
  StorageAdapter,
  ProfileSummary,
  ProductProfile,
} from "@basesignal/storage";

export class MockStorage implements StorageAdapter {
  private profiles: Map<string, ProductProfile> = new Map();
  private nextId = 1;

  async save(profile: ProductProfile): Promise<string> {
    const id =
      (profile.id as string | undefined) ?? `mock-${this.nextId++}`;
    const now = Date.now();
    this.profiles.set(id, {
      ...profile,
      id,
      updatedAt: now,
      createdAt: (profile as Record<string, unknown>).createdAt ?? now,
    } as ProductProfile);
    return id;
  }

  async load(id: string): Promise<ProductProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async list(): Promise<ProfileSummary[]> {
    return Array.from(this.profiles.values()).map((p) => ({
      id: p.id as string,
      name:
        (p.identity as { productName?: string } | undefined)?.productName ?? "",
      url:
        (p.metadata as { url?: string } | undefined)?.url ?? "",
      completeness: (p.completeness as number) ?? 0,
      updatedAt: (p.updatedAt as number) ?? 0,
    }));
  }

  async delete(id: string): Promise<boolean> {
    return this.profiles.delete(id);
  }

  async search(query: string): Promise<ProfileSummary[]> {
    const all = await this.list();
    const lower = query.toLowerCase();
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.url.toLowerCase().includes(lower)
    );
  }

  close(): void {
    // no-op for mock
  }
}

export function makeTestProfile(
  overrides: Partial<ProductProfile> = {}
): ProductProfile {
  return {
    identity: {
      productName: "Test Product",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      confidence: 0.85,
      evidence: [],
    },
    metadata: {
      url: "https://test.example.com",
    },
    completeness: 0.1,
    overallConfidence: 0.85,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as ProductProfile;
}
