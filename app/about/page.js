import SiteHeader from "@/components/SiteHeader";
import FadeIn from "@/components/FadeIn";

export const metadata = { title: "About — LIAOLLET" };

export default function AboutPage() {
  return (
    <div className="hero-page">
      <SiteHeader />

      <div className="about">
        <div className="about-grid">
          <FadeIn y={30} duration={0.7}>
            <img
              src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800"
              alt="Artist studio"
              className="about-img"
            />
          </FadeIn>

          <FadeIn y={30} duration={0.7} delay={0.2} className="about-bio">
            <h1 className="about-title">About the Artist</h1>

            <div className="about-text">
              <p>
                Working primarily in oil and acrylic on canvas, I explore the intersection of colour, texture and emotional
                landscape. Each piece begins as an intuitive response to light and space, evolving through layers of material
                and gesture.
              </p>
              <p>
                My practice is rooted in the belief that abstract painting can communicate what language cannot — the felt
                experience of a place, a moment, a shift in atmosphere. I work across various scales, from intimate studies to
                large immersive canvases.
              </p>
              <p>
                Studio based in London. Works available in sizes ranging from 70 × 100 cm to 180 × 200 cm, with custom
                commissions considered on request.
              </p>
            </div>

            <div className="about-contact">
              <p>For inquiries and commissions:</p>
              <a href="mailto:hello@artist-studio.com">hello@artist-studio.com</a>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
