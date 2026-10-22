import { notFound } from "next/navigation";
import { artworks, getArtworkBySlug, getAdjacentArtworks } from "@/lib/artworks";
import ArtworkDetail from "@/components/ArtworkDetail";

// 빌드 시 모든 작품 페이지를 미리 생성
export function generateStaticParams() {
  return artworks.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const artwork = getArtworkBySlug(slug);
  return { title: artwork ? `${artwork.title} — LIAOLLET` : "Artwork not found" };
}

export default async function ArtworkPage({ params }) {
  const { slug } = await params;
  const artwork = getArtworkBySlug(slug);
  if (!artwork) notFound();
  const { prev, next } = getAdjacentArtworks(slug);
  return <ArtworkDetail artwork={artwork} prev={prev} next={next} />;
}
