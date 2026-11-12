import { SiteHeader, SiteFooter } from "@/components/brand";
import { HomeExperience } from "@/features/home/home-experience";
export default function Home() {
  return (
    <>
      <SiteHeader pathname="/" />
      <main>
        <HomeExperience />
      </main>
      <SiteFooter />
    </>
  );
}
