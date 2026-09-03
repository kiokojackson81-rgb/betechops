import CategoryPage, {
  generateMetadata as getCategoryMetadata,
} from "@/app/shop/category/[slug]/page";

type CategorySubcategoryPageProps = {
  params: Promise<{ slug: string; subcategory: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({
  params,
}: CategorySubcategoryPageProps) {
  const { slug, subcategory } = await params;
  return getCategoryMetadata({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({ sub: subcategory }),
  });
}

export default async function CategorySubcategoryPage({
  params,
  searchParams,
}: CategorySubcategoryPageProps) {
  const [{ slug, subcategory }, inheritedSearchParams] = await Promise.all([
    params,
    searchParams || Promise.resolve({}),
  ]);
  return (
    <CategoryPage
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({
        ...inheritedSearchParams,
        sub: subcategory,
      })}
    />
  );
}
