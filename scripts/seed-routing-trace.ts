#!/usr/bin/env tsx
import dayjs from "@calcom/dayjs";
import { prisma } from "@calcom/prisma";
import { AssignmentReasonEnum, BookingStatus, SchedulingType } from "@calcom/prisma/enums";
import { uuid } from "short-uuid";

async function main() {
  console.log("Seeding routing trace data for QA testing...\n");

  const proUser = await prisma.user.findFirst({
    where: { username: "teampro" },
    select: { id: true, email: true, name: true, username: true },
  });

  if (!proUser) {
    console.error("teampro user not found. Run the main seed first.");
    process.exit(1);
  }

  const team = await prisma.team.findFirst({
    where: { slug: "seeded-team" },
    select: { id: true, slug: true, name: true },
  });

  if (!team) {
    console.error("seeded-team not found. Run the main seed first.");
    process.exit(1);
  }

  const rrEventType = await prisma.eventType.findFirst({
    where: {
      teamId: team.id,
      schedulingType: SchedulingType.ROUND_ROBIN,
    },
    select: { id: true, title: true, slug: true },
  });

  if (!rrEventType) {
    console.error("No round-robin event type found on seeded-team.");
    process.exit(1);
  }

  console.log(`Using user: ${proUser.email}`);
  console.log(`Using team: ${team.name} (${team.slug})`);
  console.log(`Using event type: ${rrEventType.title} (id: ${rrEventType.id})\n`);

  const existingBooking = await prisma.booking.findFirst({
    where: {
      title: "Routing Trace QA Booking",
      userId: proUser.id,
    },
    select: { id: true },
  });

  if (existingBooking) {
    console.log("Routing trace QA data already exists, skipping.");
    return;
  }

  const routingFormId = "routing-trace-qa-form-001";
  const bookingUids = [uuid(), uuid(), uuid()];
  const now = Date.now();

  const existingForm = await prisma.app_RoutingForms_Form.findUnique({
    where: { id: routingFormId },
    select: { id: true },
  });

  if (!existingForm) {
    await prisma.app_RoutingForms_Form.create({
      data: {
        id: routingFormId,
        name: "QA Routing Form",
        fields: [
          {
            id: "qa-field-department",
            type: "select",
            label: "Department",
            required: true,
            options: [
              { id: "opt-eng", label: "Engineering" },
              { id: "opt-sales", label: "Sales" },
            ],
          },
          {
            id: "qa-field-name",
            type: "text",
            label: "Your Name",
            required: true,
          },
        ],
        routes: [
          {
            id: "qa-route-eng",
            action: {
              type: "eventTypeRedirectUrl",
              value: `team/${team.slug}/${rrEventType.slug}`,
              eventTypeId: rrEventType.id,
            },
            queryValue: {
              id: "qa-route-eng",
              type: "group",
              children1: {
                "qa-rule-eng": {
                  type: "rule",
                  properties: {
                    field: "qa-field-department",
                    value: ["opt-eng"],
                    operator: "equal",
                    valueSrc: ["value"],
                    valueType: ["select"],
                  },
                },
              },
            },
          },
          {
            id: "qa-route-fallback",
            action: {
              type: "eventTypeRedirectUrl",
              value: `team/${team.slug}/${rrEventType.slug}`,
              eventTypeId: rrEventType.id,
            },
            isFallback: true,
            queryValue: { id: "qa-route-fallback", type: "group" },
          },
        ],
        user: { connect: { id: proUser.id } },
        team: { connect: { id: team.id } },
      },
    });
    console.log("Created QA routing form");
  }

  const bookingConfigs = [
    {
      uid: bookingUids[0],
      title: "Routing Trace QA Booking",
      startTime: dayjs().add(1, "day").hour(10).minute(0).toDate(),
      endTime: dayjs().add(1, "day").hour(10).minute(15).toDate(),
      status: BookingStatus.ACCEPTED,
      reasonEnum: AssignmentReasonEnum.ROUTING_FORM_ROUTING,
      reasonString: "Routed via Engineering department rule",
      traceSteps: [
        {
          domain: "routing_form",
          step: "route_matched",
          timestamp: now - 5000,
          data: { routeId: "qa-route-eng", routeName: "Engineering Route" },
        },
        {
          domain: "routing_form",
          step: "attribute-logic-evaluated",
          timestamp: now - 4000,
          data: {
            routeId: "qa-route-eng",
            routeName: "Engineering Route",
            routeIsFallback: false,
            attributeRoutingDetails: [
              { attributeName: "Department", attributeValue: "Engineering" },
              { attributeName: "Skills", attributeValue: "JavaScript, React" },
            ],
          },
        },
      ],
    },
    {
      uid: bookingUids[1],
      title: "Routing Trace QA Booking - Fallback",
      startTime: dayjs().add(2, "day").hour(14).minute(0).toDate(),
      endTime: dayjs().add(2, "day").hour(14).minute(15).toDate(),
      status: BookingStatus.ACCEPTED,
      reasonEnum: AssignmentReasonEnum.ROUTING_FORM_ROUTING_FALLBACK,
      reasonString: "Fallback route used - no matching department",
      traceSteps: [
        {
          domain: "routing_form",
          step: "fallback_route_used",
          timestamp: now - 3000,
          data: { routeId: "qa-route-fallback", routeName: "Fallback Route" },
        },
      ],
    },
    {
      uid: bookingUids[2],
      title: "Routing Trace QA Booking - Reassigned",
      startTime: dayjs().add(3, "day").hour(9).minute(0).toDate(),
      endTime: dayjs().add(3, "day").hour(9).minute(15).toDate(),
      status: BookingStatus.ACCEPTED,
      reasonEnum: AssignmentReasonEnum.REASSIGNED,
      reasonString: "Reassigned from original host to teampro",
      traceSteps: [
        {
          domain: "routing_form",
          step: "route_matched",
          timestamp: now - 10000,
          data: { routeId: "qa-route-eng", routeName: "Engineering Route" },
        },
        {
          domain: "routing_form",
          step: "attribute-logic-evaluated",
          timestamp: now - 9000,
          data: {
            routeId: "qa-route-eng",
            routeName: "Engineering Route",
            routeIsFallback: false,
            attributeRoutingDetails: [
              { attributeName: "Department", attributeValue: "Engineering" },
            ],
          },
        },
      ],
    },
  ];

  for (const config of bookingConfigs) {
    const booking = await prisma.booking.create({
      data: {
        uid: config.uid,
        title: config.title,
        startTime: config.startTime,
        endTime: config.endTime,
        status: config.status,
        user: { connect: { id: proUser.id } },
        eventType: { connect: { id: rrEventType.id } },
        attendees: {
          create: {
            email: "qa-attendee@example.com",
            name: "QA Attendee",
            timeZone: "America/New_York",
          },
        },
        iCalUID: "",
      },
      select: { id: true, uid: true },
    });

    const formResponse = await prisma.app_RoutingForms_FormResponse.create({
      data: {
        formId: routingFormId,
        formFillerId: uuid(),
        response: {
          "qa-field-department": { label: "Department", value: "opt-eng" },
          "qa-field-name": { label: "Your Name", value: "QA Tester" },
        },
        routedToBookingUid: booking.uid,
      },
      select: { id: true },
    });

    const assignmentReason = await prisma.assignmentReason.create({
      data: {
        bookingId: booking.id,
        reasonEnum: config.reasonEnum,
        reasonString: config.reasonString,
      },
      select: { id: true },
    });

    await prisma.routingTrace.create({
      data: {
        trace: config.traceSteps,
        bookingUid: booking.uid,
        formResponseId: formResponse.id,
        assignmentReasonId: assignmentReason.id,
      },
    });

    console.log(`Created booking "${config.title}" (uid: ${booking.uid})`);
    console.log(`  -> AssignmentReason: ${config.reasonEnum} - "${config.reasonString}"`);
    console.log(`  -> RoutingTrace: ${config.traceSteps.length} steps`);
  }

  console.log("\nRouting trace QA seed complete!");
  console.log(`\nLogin as teampro:teampro to see these bookings at ${process.env.NEXT_PUBLIC_WEBAPP_URL}/bookings/upcoming`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
