export type ActiveStrategyName = "ImmediateUpdate" | "HighWaterMark" | "MonthlyProration";

export type HealthStatus = "ok" | "warn" | "error";

export interface HealthCheck {
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface HwmPrediction {
  daysUntilPeriodEnd: number;
  daysUntilReconciliation: number;
  reconciliationDate: string;
  pastReconciliationWindow: boolean;
  expectedStripeQty: number;
  currentStripeQty: number;
  additionalSeatsCharged: number;
  expectedCharge: number;
}

export interface ProrationPrediction {
  daysUntilCronRun: number;
  cronRunDate: string;
  daysRemainingInPeriod: number;
  totalDaysInPeriod: number;
  currentNetIncrease: number;
  estimatedAmount: number;
  willGenerateInvoice: boolean;
  alreadyProcessedThisMonth: boolean;
}

export interface SeatBillingDebugData {
  teamId: number;

  activeStrategy: ActiveStrategyName;
  strategyReason: string;

  featureFlags: {
    hwmSeating: boolean;
    monthlyProration: boolean;
  };

  billingPeriod: {
    period: string | null;
    subscriptionStart: string | null;
    subscriptionEnd: string | null;
    trialEnd: string | null;
    isInTrial: boolean;
    pricePerSeat: number | null;
    isOrganization: boolean;
  };

  hwm: {
    highWaterMark: number | null;
    periodStart: string | null;
    paidSeats: number | null;
    currentMembers: number;
    mismatch: boolean;
  } | null;

  proration: {
    id: string;
    monthKey: string;
    seatsAtStart: number;
    seatsAtEnd: number;
    seatsAdded: number;
    seatsRemoved: number;
    netSeatIncrease: number;
    proratedAmount: number;
    status: string;
    invoiceUrl: string | null;
  } | null;

  seatChanges: {
    additions: number;
    removals: number;
    netChange: number;
  };

  stripeSubscription: {
    status: string;
    quantity: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    pricePerSeat: number | null;
  } | null;

  recentInvoices: Array<{
    id: string;
    amountDue: number;
    status: string | null;
    created: string;
    hostedInvoiceUrl: string | null;
  }>;

  testClock: {
    customerId: string;
    subscriptionId: string;
  } | null;

  predictions: {
    hwm: HwmPrediction | null;
    proration: ProrationPrediction | null;
  };

  healthChecks: HealthCheck[];

  errors: string[];
}
