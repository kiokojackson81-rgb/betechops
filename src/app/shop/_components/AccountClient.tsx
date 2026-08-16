"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CalendarCheck2,
  CreditCard,
  MapPin,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import CustomerAccountSidebar from "@/app/shop/_components/CustomerAccountSidebar";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";
import type { SerializedQuoteRequest } from "@/lib/quoteRequests";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import {
  getShopCustomerProfile,
  getMockOrderHistory,
  saveShopCustomerProfile,
  type MockOrderRecord,
} from "@/app/shop/shopStorage";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { SHOP_ACCOUNT_ORDERS_HREF, SHOP_CHECKOUT_HREF } from "@/app/shop/storefrontPaths";
import {
  formatQuoteCurrency,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
} from "@/lib/quoteProposal";
import type { SerializedLppAccount } from "@/lib/lipaPolePoleService";

type AccountClientProps = {
  initialProfile: {
    name: string;
    email: string;
    phone: string;
    whatsappNumber: string;
    county: string;
    town: string;
    estateLandmark: string;
    locationNotes: string;
  };
  recentOrders: Array<{
    id: string;
    routeId: string;
    orderRef: string;
    status: string;
    total: number;
    createdAt: string;
    deliveryMethod: string;
    customerLocation: string;
    itemsCount: number;
    receiptId?: string | null;
    itemPreview: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
      sku: string | null;
      category: string | null;
    }>;
  }>;
  recentQuotes: SerializedQuoteRequest[];
  recentSiteVisits: SerializedSiteVisit[];
  recentLppAccounts: SerializedLppAccount[];
};

function buildFormProfile(
  initialProfile: AccountClientProps["initialProfile"],
  storedProfile?: ReturnType<typeof getShopCustomerProfile> | null,
) {
  const [storedCounty = "", storedTown = ""] = String(storedProfile?.countyTown || "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    name: initialProfile.name || storedProfile?.fullName || "",
    phone: initialProfile.phone || storedProfile?.phone || "",
    whatsappNumber: initialProfile.whatsappNumber || storedProfile?.whatsappNumber || storedProfile?.phone || "",
    email: initialProfile.email || storedProfile?.email || "",
    county: initialProfile.county || storedCounty || "",
    town: initialProfile.town || storedTown || "",
    estateLandmark: initialProfile.estateLandmark || storedProfile?.estateLandmark || "",
    locationNotes: initialProfile.locationNotes || storedProfile?.locationNotes || "",
  };
}

function formatOrderStatus(status: string) {
  if (status === "COMPLETE") return "Complete";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatProjectLabel(value?: string | null) {
  if (!value) return "Solar quotation";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSiteVisitStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatSiteVisitOutcome(value?: string | null) {
  if (!value) return "Visit in progress";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AccountClient({
  initialProfile,
  recentOrders,
  recentQuotes,
  recentSiteVisits,
  recentLppAccounts,
}: AccountClientProps) {
  const [localOrders, setLocalOrders] = useState<MockOrderRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => buildFormProfile(initialProfile));
  const [editingAddress, setEditingAddress] = useState(
    () => !(initialProfile.county || initialProfile.town || initialProfile.estateLandmark || initialProfile.locationNotes),
  );
  const availableTowns = useMemo(() => getTownsForCounty(form.county), [form.county]);

  useEffect(() => {
    setForm(buildFormProfile(initialProfile, getShopCustomerProfile()));
    setEditingAddress(!(initialProfile.county || initialProfile.town || initialProfile.estateLandmark || initialProfile.locationNotes));
  }, [initialProfile]);

  useEffect(() => {
    setLocalOrders(getMockOrderHistory());
  }, []);

  useEffect(() => {
    saveShopCustomerProfile({
      fullName: form.name.trim(),
      phone: form.phone.trim(),
      whatsappNumber: form.whatsappNumber.trim() || form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      countyTown: [form.county.trim(), form.town.trim()].filter(Boolean).join(" / ") || undefined,
      estateLandmark: form.estateLandmark.trim() || undefined,
      locationNotes: form.locationNotes.trim() || undefined,
    });
  }, [form]);

  const profileCompletion = useMemo(() => {
    const fields = [form.name, form.phone, form.email, form.county, form.town];
    const complete = fields.filter((value) => value.trim()).length;
    return Math.round((complete / fields.length) * 100);
  }, [form]);
  const activeLppAccounts = recentLppAccounts.filter((account) => !["COMPLETED", "CONVERTED_TO_POS", "CONVERTED_TO_PROJECT", "CANCELLED", "REFUNDED", "CLOSED"].includes(account.status));
  const lppTotalPaid = recentLppAccounts.reduce((total, account) => total + account.totalPaid, 0);
  const lppRemaining = activeLppAccounts.reduce((total, account) => total + account.balance, 0);
  const lppCompleted = recentLppAccounts.filter((account) => ["COMPLETED", "CONVERTED_TO_POS", "CONVERTED_TO_PROJECT", "CLOSED"].includes(account.status)).length;

  const effectiveOrders = useMemo(() => {
    if (recentOrders.length) return recentOrders;

    return localOrders.slice(0, 5).map((order) => ({
      id: order.orderRef,
      routeId: `website-${order.orderRef}`,
      orderRef: order.orderRef,
      status: order.status,
      total: order.subtotal,
      createdAt: order.createdAt,
      deliveryMethod: order.deliveryMethod,
      customerLocation: order.location,
      itemsCount: order.items.length,
      receiptId: null,
      itemPreview: order.items.slice(0, 3).map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.lineTotal,
        sku: null,
        category: null,
      })),
    }));
  }, [localOrders, recentOrders]);

  const addressLine = [form.town.trim(), form.county.trim()].filter(Boolean).join(", ");
  const hasSavedAddress = Boolean(form.county.trim() || form.town.trim() || form.estateLandmark.trim() || form.locationNotes.trim());

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          whatsappNumber: form.whatsappNumber,
          county: form.county,
          town: form.town,
          estateLandmark: form.estateLandmark,
          locationNotes: form.locationNotes,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        user?: Partial<AccountClientProps["initialProfile"]>;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "We could not save your account profile right now.");
      }

      const persistedProfile = {
        ...form,
        ...data.user,
        name: form.name,
        phone: form.phone,
        whatsappNumber: form.whatsappNumber,
        email: form.email,
        county: form.county,
        town: form.town,
        estateLandmark: form.estateLandmark,
        locationNotes: form.locationNotes,
      };

      setForm(persistedProfile);
      saveShopCustomerProfile({
        fullName: persistedProfile.name.trim(),
        phone: persistedProfile.phone.trim(),
        whatsappNumber: persistedProfile.whatsappNumber.trim() || persistedProfile.phone.trim() || undefined,
        email: persistedProfile.email.trim() || undefined,
        countyTown: [persistedProfile.county.trim(), persistedProfile.town.trim()].filter(Boolean).join(" / ") || undefined,
        estateLandmark: persistedProfile.estateLandmark.trim() || undefined,
        locationNotes: persistedProfile.locationNotes.trim() || undefined,
      });
      if (persistedProfile.county.trim() || persistedProfile.town.trim() || persistedProfile.estateLandmark.trim() || persistedProfile.locationNotes.trim()) {
        setEditingAddress(false);
      }
      setNotice("Customer details saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your customer details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <CustomerAccountSidebar activeSection="overview" profileCompletion={profileCompletion} />

      <div className="grid gap-4">
        <section id="account-overview" className="grid gap-4 scroll-mt-28 lg:grid-cols-3">
          <div className={`${shopStyles.lightCard} p-5`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
              <UserRound className="h-4 w-4" />
              Account details
            </div>
            <div className="mt-4 text-xl font-black text-slate-950">{form.name || "Add your full name"}</div>
            <div className="mt-2 text-sm text-slate-600">{form.email || "No email saved yet."}</div>
            <div className="mt-1 text-sm text-slate-600">{form.phone || "No phone number saved yet."}</div>
            <div className="mt-1 text-sm text-slate-600">{form.whatsappNumber ? `WhatsApp: ${form.whatsappNumber}` : "No WhatsApp number saved yet."}</div>
          </div>

          <div id="address-details" className={`${shopStyles.lightCard} scroll-mt-28 p-5`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
              <MapPin className="h-4 w-4" />
              Address book
            </div>
            <div className="mt-4 text-base font-bold text-slate-950">{addressLine || "Add county and town"}</div>
            <div className="mt-2 text-sm text-slate-600">
              {addressLine ? "This location will be reused for delivery planning and customer follow-up." : "Your saved delivery location will appear here after profile update."}
            </div>
            <div className="mt-3 text-sm text-slate-500">{form.estateLandmark || "No estate or landmark saved yet."}</div>
          </div>

          <div className={`${shopStyles.lightCard} p-5`}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
              <CreditCard className="h-4 w-4" />
              Account status
            </div>
            <div className="mt-4 flex items-center gap-2 text-base font-bold text-slate-950">
              <CheckCircle2 className="h-5 w-5 text-[#0f9d58]" />
              Verified OTP customer
            </div>
            <div className="mt-2 text-sm text-slate-600">Passwordless sign-in is active for this account using email OTP or phone OTP.</div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
          <div className={`${shopStyles.lightCard} p-5 sm:p-6`}>
            <div className={shopStyles.sectionEyebrow}>Customer profile</div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Manage your saved customer details</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              These details are saved to your Betech Solar account and used to make future checkout and support follow-up faster.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Full name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Phone number
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                WhatsApp number
                <input
                  value={form.whatsappNumber}
                  onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))}
                  className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                County
                <select
                  value={form.county}
                  onChange={(event) => {
                    const nextCounty = event.target.value;
                    const nextTowns = getTownsForCounty(nextCounty);
                    setForm((current) => ({
                      ...current,
                      county: nextCounty,
                      town: nextTowns.some((town) => town === current.town) ? current.town : "",
                    }));
                  }}
                  className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                >
                  <option value="">Select county</option>
                  {kenyaCountyOptions.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
              </label>
              {hasSavedAddress && !editingAddress ? (
                <div className="grid gap-3 sm:col-span-2">
                  <div className="rounded-[18px] border border-[#0f9d58]/15 bg-[linear-gradient(180deg,#f6fff9_0%,#ffffff_100%)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#0f9d58]">Saved address</div>
                        <div className="mt-2 text-lg font-black text-slate-950">{addressLine || "Address saved"}</div>
                        <div className="mt-2 text-sm text-slate-600">{form.estateLandmark.trim() || "No estate or landmark added yet."}</div>
                        <div className="mt-1 text-sm text-slate-500">{form.locationNotes.trim() || "No extra delivery notes added yet."}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingAddress(true)}
                        className="rounded-[14px] border border-[#7a0000]/12 bg-white px-3 py-2 text-sm font-bold text-[#7a0000]"
                      >
                        Edit address
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Town / area
                    <select
                      value={form.town}
                      onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))}
                      disabled={!form.county}
                      className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                    >
                      <option value="">{form.county ? "Select town / area" : "Choose county first"}</option>
                      {availableTowns.map((town) => (
                        <option key={town} value={town}>
                          {town}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Specific locality / estate / landmark
                    <input
                      value={form.estateLandmark}
                      onChange={(event) => setForm((current) => ({ ...current, estateLandmark: event.target.value }))}
                      className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Delivery notes
                    <textarea
                      rows={3}
                      value={form.locationNotes}
                      onChange={(event) => setForm((current) => ({ ...current, locationNotes: event.target.value }))}
                      className="rounded-[16px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/35"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" className={shopStyles.primaryButton} onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save customer details"}
              </button>
              <Link href={SHOP_CHECKOUT_HREF} className={shopStyles.secondaryButton}>
                Continue to checkout
              </Link>
              {notice ? <div className="text-sm font-semibold text-[#0f9d58]">{notice}</div> : null}
              {error ? <div className="text-sm font-semibold text-[#b42318]">{error}</div> : null}
            </div>
          </div>

          <div className="grid gap-4">
            <section id="recent-orders" className={`${shopStyles.lightCard} scroll-mt-28 p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div className={shopStyles.sectionEyebrow}>Recent orders</div>
                <Link href={SHOP_ACCOUNT_ORDERS_HREF} className={shopStyles.secondaryButton}>
                  View all orders
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {effectiveOrders.length ? (
                  effectiveOrders.slice(0, 1).map((order) => (
                    <div key={order.id} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-950">{order.orderRef}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)} • {order.deliveryMethod}</div>
                        </div>
                        <div className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                          {formatOrderStatus(order.status)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>{formatCurrency(order.total)}</span>
                        <span>{order.itemsCount} items</span>
                      </div>
                      {order.itemPreview.length ? (
                        <div className="mt-3 overflow-hidden rounded-[16px] border border-[#7a0000]/10 bg-white">
                          {order.itemPreview.map((item, index) => (
                            <div
                              key={`${order.id}-${item.productName}-${index}`}
                              className={`${index ? "border-t border-[#7a0000]/10" : ""}`}
                            >
                              <div className="bg-[#fffdf8] px-3 py-3">
                                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                                  Item name
                                </div>
                                <div className="mt-1 break-words text-sm font-bold leading-6 text-slate-950" title={item.productName}>
                                  {item.productName}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {[item.sku, item.category].filter(Boolean).join(" • ") || order.customerLocation}
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3 border-t border-[#7a0000]/10 px-3 py-3 text-sm text-slate-700">
                                <div>
                                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                                    Quantity
                                  </div>
                                  <div className="mt-1 font-semibold text-slate-950">{item.quantity}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                                    Unit price
                                  </div>
                                  <div className="mt-1 font-semibold text-slate-950">{formatCurrency(item.unitPrice)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                                    Total
                                  </div>
                                  <div className="mt-1 font-black text-slate-950">{formatCurrency(item.total)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-500">{order.customerLocation}</div>
                      )}
                      <div className="mt-3 flex flex-nowrap items-center gap-3 overflow-x-auto">
                        <Link
                          href={`/account/orders/${encodeURIComponent(order.routeId)}`}
                          className={`${shopStyles.secondaryButton} whitespace-nowrap`}
                        >
                          View order details
                        </Link>
                        {order.receiptId ? (
                          <a
                            href={`/api/receipts/${encodeURIComponent(order.receiptId)}/pdf?download=1`}
                            target="_blank"
                            rel="noreferrer"
                            className={`${shopStyles.secondaryButton} whitespace-nowrap`}
                          >
                            Download receipt
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No recent orders saved yet.</div>
                )}
              </div>
            </section>

            <section id="quote-follow-up" className={`${shopStyles.lightCard} scroll-mt-28 p-5`}>
              <div className={shopStyles.sectionEyebrow}>Quote follow-up</div>
              <div className="mt-4 space-y-3">
                {recentQuotes.length ? (
                  recentQuotes.slice(0, 3).map((quote) => {
                    const proposal = parseStoredQuoteProposal(quote.quotationData);
                    const itemPreview = proposal.items.slice(0, 2).map((item) => item.itemName).join(" • ");

                    return (
                      <div key={quote.id} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-950">{quote.quoteRef}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatProjectLabel(quote.projectType || quote.propertyType)} • {formatDate(quote.createdAt)}
                            </div>
                          </div>
                          <div className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                            {formatOrderStatus(quote.status)}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          {quote.customerLocation || [quote.town, quote.county].filter(Boolean).join(", ") || "Location pending"}
                        </div>
                        {quote.quoteTitle || quote.quoteMessage ? (
                          <div className="mt-3 rounded-[14px] border border-[#7a0000]/10 bg-white px-3 py-3">
                            {quote.quoteTitle ? <div className="text-sm font-bold text-slate-950">{quote.quoteTitle}</div> : null}
                            {quote.quoteMessage ? (
                              <div className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{quote.quoteMessage}</div>
                            ) : null}
                          </div>
                        ) : null}
                        {proposal.items.length ? (
                          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <div><span className="font-bold text-slate-950">Items:</span> {proposal.items.length}</div>
                            <div><span className="font-bold text-slate-950">Total:</span> {formatQuoteCurrency(proposal.total)}</div>
                            <div className="sm:col-span-2">
                              <span className="font-bold text-slate-950">Payment terms:</span>{" "}
                              {getQuotePaymentTermsLabel(proposal.paymentTerms)}
                            </div>
                            {itemPreview ? (
                              <div className="sm:col-span-2">
                                <span className="font-bold text-slate-950">Quoted items:</span> {itemPreview}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a
                            href={`/api/shop/quotes/${encodeURIComponent(quote.id)}/pdf`}
                            className="inline-flex items-center rounded-full border border-[#7a0000]/15 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#7a0000] transition hover:border-[#7a0000]/30"
                          >
                            Download PDF
                          </a>
                          <Link
                            href="/request-quote"
                            className="inline-flex items-center rounded-full border border-[#0f172a]/10 bg-[#fff3d8] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-950 transition hover:border-[#7a0000]/20"
                          >
                            Request update
                          </Link>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-500">No recent quote requests saved yet.</div>
                )}
              </div>
            </section>

            <section id="lipa-pole-pole" className={`${shopStyles.lightCard} scroll-mt-28 p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div className={shopStyles.sectionEyebrow}>Lipa Pole Pole</div>
                <Link href="/shop" className={shopStyles.secondaryButton}>
                  Start another
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Active plans</div><div className="mt-1 text-xl font-black text-slate-950">{activeLppAccounts.length}</div></div>
                <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Total paid</div><div className="mt-1 text-xl font-black text-slate-950">{formatCurrency(lppTotalPaid)}</div></div>
                <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Remaining</div><div className="mt-1 text-xl font-black text-slate-950">{formatCurrency(lppRemaining)}</div></div>
                <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Completed</div><div className="mt-1 text-xl font-black text-slate-950">{lppCompleted}</div></div>
              </div>
              <div className="mt-4 space-y-3">
                {recentLppAccounts.length ? (
                  recentLppAccounts.slice(0, 3).map((account) => (
                    <div key={account.id} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-950">{account.reference}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {account.productName || "Reserved product"} • {formatDate(account.createdAt)}
                          </div>
                        </div>
                        <div className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                          {formatOrderStatus(account.status)}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div><span className="font-bold text-slate-950">Total:</span> {formatCurrency(account.agreedTotal)}</div>
                        <div><span className="font-bold text-slate-950">Paid:</span> {formatCurrency(account.totalPaid)}</div>
                        <div><span className="font-bold text-slate-950">Balance:</span> {formatCurrency(account.balance)}</div>
                        <div><span className="font-bold text-slate-950">Due:</span> {account.expectedCompletionDate ? formatDate(account.expectedCompletionDate) : "Not set"}</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ecdcc5]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#7a0000_0%,#d97706_100%)]"
                          style={{ width: `${Math.max(2, Math.min(100, account.percentagePaid || 0))}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-600">
                        {account.percentagePaid.toFixed(2)}% paid
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {account.balance > 0 ? (
                          <Link href={`/shop/account/lipa-pole-pole/${encodeURIComponent(account.id)}#make-payment`} className={`${shopStyles.primaryButton} whitespace-nowrap`}>
                            Make a payment
                          </Link>
                        ) : null}
                        <Link
                          href={`/shop/account/lipa-pole-pole/${encodeURIComponent(account.id)}`}
                          className={`${shopStyles.secondaryButton} whitespace-nowrap`}
                        >
                          Open account
                        </Link>
                        <Link
                          href={`/shop/account/lipa-pole-pole/${encodeURIComponent(account.id)}/statement`}
                          className={`${shopStyles.secondaryButton} whitespace-nowrap`}
                        >
                          Print statement
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No Lipa Pole Pole accounts are linked to this customer yet.</div>
                )}
              </div>
            </section>

            <section id="site-visits" className={`${shopStyles.lightCard} scroll-mt-28 p-5`}>
              <div className="flex items-center gap-2">
                <div className={shopStyles.sectionEyebrow}>Site visits</div>
                <CalendarCheck2 className="h-4 w-4 text-[#7a0000]" />
              </div>
              <div className="mt-4 space-y-3">
                {recentSiteVisits.length ? (
                  recentSiteVisits.slice(0, 3).map((visit) => (
                    <div key={visit.id} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-950">{visit.visitRef}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatProjectLabel(visit.projectType)} • {formatDate(visit.scheduledAt || visit.createdAt)}
                          </div>
                        </div>
                        <div className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                          {formatSiteVisitStatus(visit.status)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {[visit.location, visit.town, visit.county].filter(Boolean).join(", ") || "Location pending"}
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div><span className="font-bold text-slate-950">Assigned:</span> {visit.assignedTechnicianName || visit.assignedStaffName || "Betech team pending"}</div>
                        <div><span className="font-bold text-slate-950">Visit status:</span> {formatSiteVisitStatus(visit.status)}</div>
                        <div className="sm:col-span-2">
                          <span className="font-bold text-slate-950">Outcome:</span> {formatSiteVisitOutcome(visit.outcome)}
                        </div>
                        {visit.quoteRef ? (
                          <div className="sm:col-span-2">
                            <span className="font-bold text-slate-950">Linked quotation:</span> {visit.quoteRef}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No site visits have been scheduled on your account yet.</div>
                )}
              </div>
            </section>

            <section className={`${shopStyles.softCard} p-5`}>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Phone className="h-4 w-4 text-[#7a0000]" />
                Betech support help
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-950">Phone:</span>{" "}
                  <a href="tel:+254722151083" className="hover:text-[#7a0000]">
                    +254 722 151 083
                  </a>
                </div>
                <div>
                  <span className="font-semibold text-slate-950">Alternative phone:</span>{" "}
                  <a href="tel:+254703241917" className="hover:text-[#7a0000]">
                    +254 703 241 917
                  </a>
                </div>
                <div>
                  <span className="font-semibold text-slate-950">Email:</span>{" "}
                  <a href="mailto:info@betech.co.ke" className="hover:text-[#7a0000]">
                    info@betech.co.ke
                  </a>
                </div>
                <div>
                  <span className="font-semibold text-slate-950">Shop Location:</span>{" "}
                  <span>Pramukh Plaza, Third Floor, Shop No. 3 at Junction of Munyu Road and Sheikh Karume, Nairobi CBD</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-950">WhatsApp:</span>{" "}
                  <TrackedWhatsAppLink
                    href="https://wa.me/254722151083"
                    className="font-semibold text-[#0f9d58] hover:text-[#0c7f47]"
                    label="Account support WhatsApp"
                    context="account_support_card"
                    ariaLabel="Chat with Betech Solar on WhatsApp"
                  >
                    Click to WhatsApp
                  </TrackedWhatsAppLink>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
