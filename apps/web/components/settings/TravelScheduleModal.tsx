import { CalendarIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, useId } from "react";
import type { UseFormSetValue } from "react-hook-form";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import dayjs from "@calcom/dayjs";
import { useTimePreferences } from "@calcom/features/bookings/lib/timePreferences";
import { useLocale } from "@calcom/lib/hooks/useLocale";

import { Button } from "@coss/ui/components/button";
import { Calendar } from "@coss/ui/components/calendar";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@coss/ui/components/popover";
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
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@coss/ui/components/dialog";
import { Field, FieldLabel, FieldError } from "@coss/ui/components/field";
import { Switch } from "@coss/ui/components/switch";

import type { FormValues } from "~/settings/my-account/general-view";

interface TravelScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setValue: UseFormSetValue<FormValues>;
  existingSchedules: FormValues["travelSchedules"];
}

const timezones = Intl.supportedValuesOf("timeZone");

const TravelScheduleModal = ({
  open,
  onOpenChange,
  setValue,
  existingSchedules,
}: TravelScheduleModalProps) => {
  const datePitckerId = useId();
  const timezoneId = useId();
  const { t } = useLocale();
  const { timezone: preferredTimezone } = useTimePreferences();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [selectedTimeZone, setSelectedTimeZone] = useState(preferredTimezone);

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
  }, []);

  const currentTimezone = formattedTimezones.find((tz) => tz.value === selectedTimeZone);
  const [isNoEndDate, setIsNoEndDate] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isDateInExistingSchedule = (date: Date): boolean => {
    const checkDate = dayjs(date).startOf("day");

    for (const schedule of existingSchedules) {
      const start = dayjs(schedule.startDate).startOf("day");
      const end = schedule.endDate ? dayjs(schedule.endDate).startOf("day") : null;

      if (!end) {
        // Schedule without end date: disable if date is on or after start date
        if (checkDate.isSame(start) || checkDate.isAfter(start)) {
          return true;
        }
      } else {
        // Schedule with end date: disable if date falls within the range (inclusive)
        if (
          (checkDate.isSame(start) || checkDate.isAfter(start)) &&
          (checkDate.isSame(end) || checkDate.isBefore(end))
        ) {
          return true;
        }
      }
    }

    return false;
  };

  const isOverlapping = (newSchedule: { startDate: Date; endDate?: Date }) => {
    const newStart = dayjs(newSchedule.startDate);
    const newEnd = newSchedule.endDate ? dayjs(newSchedule.endDate) : null;

    for (const schedule of existingSchedules) {
      const start = dayjs(schedule.startDate);
      const end = schedule.endDate ? dayjs(schedule.endDate) : null;

      if (!newEnd) {
        // if the start date is after or on the existing schedule's start date and before the existing schedule's end date (if it has one)
        if (newStart.isSame(start) || newStart.isAfter(start)) {
          if (!end || newStart.isSame(end) || newStart.isBefore(end)) return true;
        }
      } else {
        // For schedules with an end date, check for any overlap
        if (newStart.isSame(end) || newStart.isBefore(end) || end === null) {
          if (newEnd.isSame(start) || newEnd.isAfter(start)) {
            return true;
          }
        }
      }
    }
  };

  const resetValues = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDateRange(undefined);
    setSelectedTimeZone(preferredTimezone);
    setIsNoEndDate(false);
  };

  const createNewSchedule = () => {
    if (!startDate) return;

    const newSchedule = {
      startDate,
      endDate,
      timeZone: selectedTimeZone,
    };

    if (!isOverlapping(newSchedule)) {
      setValue("travelSchedules", existingSchedules.concat(newSchedule), { shouldDirty: true });
      onOpenChange(false);
      resetValues();
    } else {
      setErrorMessage(t("overlaps_with_existing_schedule"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("travel_schedule")}</DialogTitle>
          <DialogDescription>{t("travel_schedule_description")}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="grid gap-4">
          <div className="flex flex-col gap-3">
            <div>
              {!isNoEndDate ? (
                <Field>
                  <FieldLabel htmlFor={datePitckerId}>{t("time_range")}</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button className="w-full justify-start font-normal" variant="outline" id={datePitckerId} />
                      }>
                      <CalendarIcon aria-hidden="true" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>{t("select_date_range")}</span>
                      )}
                    </PopoverTrigger>
                    <PopoverPopup align="start">
                      <Calendar
                        defaultMonth={dateRange?.from}
                        mode="range"
                        onSelect={(range) => {
                          if (range) {
                            setDateRange(range);
                            setStartDate(range.from);
                            setEndDate(range.to);
                            setErrorMessage("");
                          }
                        }}
                        selected={dateRange}
                        disabled={(date) => {
                          const today = new Date(new Date().setHours(0, 0, 0, 0));
                          return date < today || isDateInExistingSchedule(date);
                        }}
                      />
                    </PopoverPopup>
                  </Popover>
                  {errorMessage && <FieldError match={true}>{errorMessage}</FieldError>}
                </Field>
              ) : (
                <Field>
                  <FieldLabel>{t("date")}</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button className="w-full justify-start font-normal" variant="outline" />
                      }>
                      <CalendarIcon aria-hidden="true" />
                      {startDate ? format(startDate, "LLL dd, y") : <span>{t("select_date")}</span>}
                    </PopoverTrigger>
                    <PopoverPopup>
                      <Calendar
                        defaultMonth={startDate}
                        mode="single"
                        onSelect={(date) => {
                          if (date) {
                            setStartDate(date);
                            setDateRange({ from: date, to: undefined });
                            setErrorMessage("");
                          }
                        }}
                        selected={startDate}
                        disabled={(date) => {
                          const today = new Date(new Date().setHours(0, 0, 0, 0));
                          return date < today || isDateInExistingSchedule(date);
                        }}
                      />
                    </PopoverPopup>
                  </Popover>
                  {errorMessage && <FieldError match={true}>{errorMessage}</FieldError>}
                </Field>
              )}
            </div>
            <Field>
              <FieldLabel>
                <Switch
                  checked={isNoEndDate}
                  onCheckedChange={(checked) => {
                    setIsNoEndDate(checked);
                    if (checked) {
                      // Switching to single date mode
                      setEndDate(undefined);
                      setDateRange(startDate ? { from: startDate, to: undefined } : undefined);
                    } else {
                      // Switching to range mode
                      if (startDate) {
                        setEndDate(startDate);
                        setDateRange({ from: startDate, to: startDate });
                      } else {
                        setEndDate(undefined);
                        setDateRange(undefined);
                      }
                    }
                    setErrorMessage("");
                  }}
                />
                {t("schedule_tz_without_end_date")}
              </FieldLabel>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor={timezoneId}>{t("timezone")}</FieldLabel>
            <Combobox
              autoHighlight
              value={currentTimezone}
              onValueChange={(newValue) => {
                if (newValue) {
                  setSelectedTimeZone(newValue.value);
                }
              }}
              items={formattedTimezones}>
              <ComboboxTrigger
                render={<Button className="w-full justify-between font-normal" variant="outline" id={timezoneId} />}>
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
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>{t("cancel")}</DialogClose>
          <Button
            disabled={isNoEndDate ? !startDate : !startDate || !endDate}
            onClick={() => {
              createNewSchedule();
            }}>
            {t("add")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
};

export default TravelScheduleModal;
