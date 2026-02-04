"use client";

import { revalidateSettingsGeneral } from "app/(use-page-wrapper)/settings/(settings-layout)/my-account/general/actions";
import { CalendarIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { Fragment, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@coss/ui/components/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
  ComboboxValue,
} from "@coss/ui/components/combobox";
import { Field, FieldDescription, FieldLabel } from "@coss/ui/components/field";
import { Fieldset, FieldsetLegend } from "@coss/ui/components/fieldset";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@coss/ui/components/frame";
import { Separator } from "@coss/ui/components/separator";
import { Label } from "@coss/ui/components/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@coss/ui/components/select";
import { Switch } from "@coss/ui/components/switch";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameFooter,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";

import { formatLocalizedDateTime } from "@calcom/lib/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { localeOptions } from "@calcom/lib/i18n";
import { nameOfDay } from "@calcom/lib/weekday";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { Form } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { revalidateTravelSchedules } from "@calcom/web/app/cache/travelSchedule";

import TravelScheduleModal from "@components/settings/TravelScheduleModal";

export type FormValues = {
  locale: {
    value: string;
    label: string;
  };
  timeZone: string;
  timeFormat: {
    value: number;
    label: string | number;
  };
  weekStart: {
    value: string;
    label: string;
  };
  travelSchedules: {
    id?: number;
    startDate: Date;
    endDate?: Date;
    timeZone: string;
  }[];
};

interface GeneralViewProps {
  user: RouterOutputs["viewer"]["me"]["get"];
  travelSchedules: RouterOutputs["viewer"]["travelSchedules"]["get"];
}

const GeneralView = ({ user, travelSchedules }: GeneralViewProps) => {
  const localeProp = user.locale ?? "en";
  const utils = trpc.useContext();
  const {
    t,
    i18n: { language },
  } = useLocale();
  const { update } = useSession();
  const [isUpdateBtnLoading, setIsUpdateBtnLoading] = useState<boolean>(false);
  const [isTZScheduleOpen, setIsTZScheduleOpen] = useState<boolean>(false);

  const mutation = trpc.viewer.me.updateProfile.useMutation({
    onSuccess: async (res) => {
      await utils.viewer.me.invalidate();
      revalidateSettingsGeneral();
      revalidateTravelSchedules();
      reset(getValues());
      showToast(t("settings_updated_successfully"), "success");
      await update(res);

      if (res.locale) {
        window.calNewLocale = res.locale;
        document.cookie = `calNewLocale=${res.locale}; path=/`;
      }
    },
    onError: () => {
      showToast(t("error_updating_settings"), "error");
    },
    onSettled: async () => {
      await utils.viewer.me.invalidate();
      revalidateSettingsGeneral();
      revalidateTravelSchedules();
      setIsUpdateBtnLoading(false);
    },
  });

  const timeFormatOptions = [
    { value: 12, label: t("12_hour") },
    { value: 24, label: t("24_hour") },
  ];

  const weekStartOptions = [
    { value: "Sunday", label: nameOfDay(localeProp, 0) },
    { value: "Monday", label: nameOfDay(localeProp, 1) },
    { value: "Tuesday", label: nameOfDay(localeProp, 2) },
    { value: "Wednesday", label: nameOfDay(localeProp, 3) },
    { value: "Thursday", label: nameOfDay(localeProp, 4) },
    { value: "Friday", label: nameOfDay(localeProp, 5) },
    { value: "Saturday", label: nameOfDay(localeProp, 6) },
  ];

  const timezones = Intl.supportedValuesOf("timeZone");

  const formattedTimezones = useMemo(() => {
    return timezones
      .map((timezone) => {
        const formatter = new Intl.DateTimeFormat("en", {
          timeZone: timezone,
          timeZoneName: "shortOffset",
        });
        const parts = formatter.formatToParts(new Date());
        const offset = parts.find((part) => part.type === "timeZoneName")?.value || "";
        const modifiedOffset = offset === "GMT" ? "GMT+0" : offset;

        const offsetMatch = offset.match(/GMT([+-]?)(\d+)(?::(\d+))?/);
        const sign = offsetMatch?.[1] === "-" ? -1 : 1;
        const hours = Number.parseInt(offsetMatch?.[2] || "0", 10);
        const minutes = Number.parseInt(offsetMatch?.[3] || "0", 10);
        const totalMinutes = sign * (hours * 60 + minutes);

        return {
          label: `(${modifiedOffset}) ${timezone.replace(/_/g, " ")}`,
          numericOffset: totalMinutes,
          value: timezone,
        };
      })
      .sort((a, b) => a.numericOffset - b.numericOffset);
  }, [timezones]);

  const formMethods = useForm<FormValues>({
    defaultValues: {
      locale: {
        value: localeProp || "",
        label: localeOptions.find((option) => option.value === localeProp)?.label || "",
      },
      timeZone: user.timeZone || "",
      timeFormat: {
        value: user.timeFormat || 12,
        label: timeFormatOptions.find((option) => option.value === user.timeFormat)?.label || 12,
      },
      weekStart: {
        value: user.weekStart,
        label: weekStartOptions.find((option) => option.value === user.weekStart)?.label || "",
      },
      travelSchedules:
        travelSchedules.map((schedule) => {
          return {
            id: schedule.id,
            startDate: schedule.startDate,
            endDate: schedule.endDate ?? undefined,
            timeZone: schedule.timeZone,
          };
        }) || [],
    },
  });
  const {
    formState: { isDirty, isSubmitting },
    reset,
    getValues,
  } = formMethods;
  const isDisabled = isSubmitting || !isDirty;

  const [isAllowDynamicBookingChecked, setIsAllowDynamicBookingChecked] = useState(
    !!user.allowDynamicBooking
  );
  const [isAllowSEOIndexingChecked, setIsAllowSEOIndexingChecked] = useState(
    user.organizationSettings?.allowSEOIndexing === false
      ? !!user.organizationSettings?.allowSEOIndexing
      : !!user.allowSEOIndexing
  );
  const [isReceiveMonthlyDigestEmailChecked, setIsReceiveMonthlyDigestEmailChecked] = useState(
    !!user.receiveMonthlyDigestEmail
  );
  const [isRequireBookerEmailVerificationChecked, setIsRequireBookerEmailVerificationChecked] = useState(
    !!user.requiresBookerEmailVerification
  );

  const watchedTzSchedules = formMethods.watch("travelSchedules");

  return (
    <div className="flex flex-col gap-4">
      <Form
        form={formMethods}
        handleSubmit={async (values) => {
          setIsUpdateBtnLoading(true);
          mutation.mutate({
            ...values,
            locale: values.locale.value,
            timeFormat: values.timeFormat.value,
            weekStart: values.weekStart.value,
          });
        }}>
        <CardFrame>
          <CardFrameHeader>
            <CardFrameTitle>{t("general")}</CardFrameTitle>
            <CardFrameDescription>{t("general_description")}</CardFrameDescription>
          </CardFrameHeader>

          <Card className="rounded-b-none!">
            <CardPanel className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Controller
                  name="locale"
                  render={({ field: { value, onChange } }) => (
                    <Field className="max-md:col-span-2">
                      <FieldLabel>{t("language")}</FieldLabel>
                      <Combobox
                        autoHighlight
                        value={value}
                        onValueChange={(newValue) => {
                          if (newValue) {
                            onChange(newValue);
                          }
                        }}
                        items={localeOptions}>
                        <ComboboxTrigger
                          render={
                            <Button
                              className="w-full justify-between font-normal capitalize"
                              variant="outline"
                            />
                          }>
                          <ComboboxValue />
                          <ChevronsUpDownIcon className="-me-1!" />
                        </ComboboxTrigger>
                        <ComboboxPopup aria-label={t("language")}>
                          <div className="border-b p-2">
                            <ComboboxInput
                              className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                              placeholder={t("search")}
                              showTrigger={false}
                              startAddon={<SearchIcon />}
                            />
                          </div>
                          <ComboboxEmpty>{t("no_options_available")}</ComboboxEmpty>
                          <ComboboxList>
                            {(item: { label: string; value: string }) => (
                              <ComboboxItem className="capitalize" key={item.value} value={item}>
                                {item.label}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxPopup>
                      </Combobox>
                    </Field>
                  )}
                />

                <div className="col-span-2">
                  <Controller
                    name="timeZone"
                    control={formMethods.control}
                    render={({ field: { value } }) => {
                      const currentTimezone = formattedTimezones.find((tz) => tz.value === value);
                      return (
                        <Fieldset className="max-w-none gap-2">
                          <Label render={<FieldsetLegend />}>{t("timezone")}</Label>
                          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                            <Field className="contents">
                              <Combobox
                                autoHighlight
                                value={currentTimezone}
                                onValueChange={(newValue) => {
                                  if (newValue) {
                                    formMethods.setValue("timeZone", newValue.value, {
                                      shouldDirty: true,
                                    });
                                  }
                                }}
                                items={formattedTimezones}>
                                <ComboboxTrigger
                                  render={
                                    <Button
                                      className="w-full justify-between font-normal"
                                      variant="outline"
                                    />
                                  }>
                                  <ComboboxValue />
                                  <ChevronsUpDownIcon className="-me-1!" />
                                </ComboboxTrigger>
                                <ComboboxPopup aria-label={t("timezone")}>
                                  <div className="border-b p-2">
                                    <ComboboxInput
                                      className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                                      placeholder={t("search_timezone")}
                                      showTrigger={false}
                                      startAddon={<SearchIcon />}
                                    />
                                  </div>
                                  <ComboboxEmpty>{t("no_options_available")}</ComboboxEmpty>
                                  <ComboboxList>
                                    {(item: { label: string; value: string; numericOffset: number }) => (
                                      <ComboboxItem key={item.value} value={item}>
                                        {item.label}
                                      </ComboboxItem>
                                    )}
                                  </ComboboxList>
                                </ComboboxPopup>
                              </Combobox>
                            </Field>
                            {!watchedTzSchedules.length && (
                              <div>
                                <Button variant="outline" onClick={() => setIsTZScheduleOpen(true)}>
                                  <CalendarIcon />
                                  {t("schedule_timezone_change")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </Fieldset>
                      );
                    }}
                  />
                </div>

                <div className="col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Controller
                    name="timeFormat"
                    control={formMethods.control}
                    render={({ field: { value } }) => (
                      <Field>
                        <FieldLabel>{t("time_format")}</FieldLabel>
                        <Select
                          aria-label={t("time_format")}
                          value={String(value.value)}
                          onValueChange={(newValue) => {
                            const selectedOption = timeFormatOptions.find(
                              (opt) => String(opt.value) === newValue
                            );
                            if (selectedOption) {
                              formMethods.setValue("timeFormat", selectedOption, {
                                shouldDirty: true,
                              });
                            }
                          }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopup>
                            {timeFormatOptions.map(({ label, value: optValue }) => (
                              <SelectItem key={optValue} value={String(optValue)}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                        <FieldDescription>{t("timeformat_profile_hint")}</FieldDescription>
                      </Field>
                    )}
                  />
                  <Controller
                    name="weekStart"
                    control={formMethods.control}
                    render={({ field: { value } }) => (
                      <Field>
                        <FieldLabel>{t("start_of_week")}</FieldLabel>
                        <Select
                          aria-label={t("start_of_week")}
                          value={value.value}
                          onValueChange={(newValue) => {
                            const selectedOption = weekStartOptions.find((opt) => opt.value === newValue);
                            if (selectedOption) {
                              formMethods.setValue("weekStart", selectedOption, {
                                shouldDirty: true,
                              });
                            }
                          }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopup>
                            {weekStartOptions.map(({ label, value: optValue }) => (
                              <SelectItem key={optValue} value={optValue}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      </Field>
                    )}
                  />
                </div>
              </div>
              {watchedTzSchedules.length > 0 && (
                <Frame>
                  <FrameHeader className="flex-row items-center justify-between">
                    <FrameTitle>{t("travel_schedule")}</FrameTitle>
                    <Button
                      className="-my-1"
                      variant="outline"
                      onClick={() => setIsTZScheduleOpen(true)}>
                      <PlusIcon />
                      {t("add")}
                    </Button>                    
                  </FrameHeader>
                  <FramePanel className="p-0 bg-card">
                    {watchedTzSchedules.map((schedule, index) => (
                      <Fragment key={index}>
                        <div className="p-5 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-sm">{`${formatLocalizedDateTime(
                              schedule.startDate,
                              { day: "numeric", month: "long" },
                              language
                            )} ${
                              schedule.endDate
                                ? `- ${formatLocalizedDateTime(
                                    schedule.endDate,
                                    { day: "numeric", month: "long" },
                                    language
                                  )}`
                                : ""
                            }`}</div>
                            <div className="text-muted-foreground text-sm">
                              {schedule.timeZone.replace(/_/g, " ")}
                            </div>
                          </div>
                          <Button
                            variant="destructive-outline"
                            size="icon"
                            onClick={() => {
                              const updatedSchedules = watchedTzSchedules.filter(
                                (_, filterIndex) => filterIndex !== index
                              );
                              formMethods.setValue("travelSchedules", updatedSchedules, {
                                shouldDirty: true,
                              });
                            }}
                            aria-label={t("delete")}
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                        {index < watchedTzSchedules.length - 1 && <Separator />}
                      </Fragment>
                    ))}
                  </FramePanel>
                </Frame>
              )}
            </CardPanel>
          </Card>

          <CardFrameFooter className="flex justify-end">
            <Button
              type="submit"
              disabled={isDisabled || isUpdateBtnLoading}
              data-testid="general-submit-button">
              {t("update")}
            </Button>
          </CardFrameFooter>
        </CardFrame>
      </Form>

      <Card>
        <CardPanel className="flex items-center justify-between gap-4">
          <CardFrameHeader className="p-0">
            <CardFrameTitle>{t("dynamic_booking")}</CardFrameTitle>
            <CardFrameDescription>{t("allow_dynamic_booking")}</CardFrameDescription>
          </CardFrameHeader>
          <Switch
            disabled={mutation.isPending}
            checked={isAllowDynamicBookingChecked}
            onCheckedChange={(checked) => {
              setIsAllowDynamicBookingChecked(checked);
              mutation.mutate({ allowDynamicBooking: checked });
            }}
          />
        </CardPanel>
      </Card>

      <Card data-testid="my-seo-indexing-switch">
        <CardPanel className="flex items-center justify-between gap-4">
          <CardFrameHeader className="p-0">
            <CardFrameTitle>{t("seo_indexing")}</CardFrameTitle>
            <CardFrameDescription>{t("allow_seo_indexing")}</CardFrameDescription>
          </CardFrameHeader>
          <Switch
            disabled={mutation.isPending || user.organizationSettings?.allowSEOIndexing === false}
            checked={isAllowSEOIndexingChecked}
            onCheckedChange={(checked) => {
              setIsAllowSEOIndexingChecked(checked);
              mutation.mutate({ allowSEOIndexing: checked });
            }}
          />
        </CardPanel>
      </Card>

      <Card>
        <CardPanel className="flex items-center justify-between gap-4">
          <CardFrameHeader className="p-0">
            <CardFrameTitle>{t("monthly_digest_email")}</CardFrameTitle>
            <CardFrameDescription>{t("monthly_digest_email_for_teams")}</CardFrameDescription>
          </CardFrameHeader>
          <Switch
            disabled={mutation.isPending}
            checked={isReceiveMonthlyDigestEmailChecked}
            onCheckedChange={(checked) => {
              setIsReceiveMonthlyDigestEmailChecked(checked);
              mutation.mutate({ receiveMonthlyDigestEmail: checked });
            }}
          />
        </CardPanel>
      </Card>

      <Card>
        <CardPanel className="flex items-center justify-between gap-4">
          <CardFrameHeader className="p-0">
            <CardFrameTitle>{t("require_booker_email_verification")}</CardFrameTitle>
            <CardFrameDescription>{t("require_booker_email_verification_description")}</CardFrameDescription>
          </CardFrameHeader>
          <Switch
            disabled={mutation.isPending}
            checked={isRequireBookerEmailVerificationChecked}
            onCheckedChange={(checked) => {
              setIsRequireBookerEmailVerificationChecked(checked);
              mutation.mutate({ requiresBookerEmailVerification: checked });
            }}
          />
        </CardPanel>
      </Card>
      <TravelScheduleModal
        open={isTZScheduleOpen}
        onOpenChange={setIsTZScheduleOpen}
        setValue={formMethods.setValue}
        existingSchedules={formMethods.getValues("travelSchedules") ?? []}
      />
    </div>
  );
};

export default GeneralView;
