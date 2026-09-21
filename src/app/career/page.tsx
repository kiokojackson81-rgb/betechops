import type { Metadata } from "next";
import CareerApplicationClient from "./CareerApplicationClient";

export const metadata: Metadata = {
  title: "Careers | Betech Solar Solutions",
  description: "Apply for the Customer Service & Content Creation Graduate Trainee opportunity at Betech Solar Solutions.",
};

export default function CareerPage() {
  return <CareerApplicationClient />;
}