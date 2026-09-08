export type WeightEntry = {
  id: string;
  /** Weight in kilograms. */
  weightKg: number;
  /** ISO 8601 timestamp of when the weight was recorded. */
  recordedAt: string;
};

export type WeightPeriod = "1M" | "3M" | "6M" | "ALL";

export const WEIGHT_PERIODS: { value: WeightPeriod; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "ALL", label: "All" },
];
