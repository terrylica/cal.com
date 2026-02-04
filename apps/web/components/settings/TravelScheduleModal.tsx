import { ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import dayjs from "@calcom/dayjs";
import { useTimePreferences } from "@calcom/features/bookings/lib/timePreferences";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { DatePicker } from "@calcom/ui/components/form";
import { DatePickerWithRange as DateRangePicker } from "@calcom/ui/components/form/date-range-picker/DateRangePicker";

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
import { Field, FieldLabel } from "@coss/ui/components/field";
import { Label } from "@coss/ui/components/label";
import { Switch } from "@coss/ui/components/switch";
import { useIsMobile } from "@coss/ui/hooks/use-mobile";

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
  const { t } = useLocale();
  const { timezone: preferredTimezone } = useTimePreferences();
  const isMobile = useIsMobile();

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

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
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    setStartDate(new Date());
    setEndDate(new Date());
    setSelectedTimeZone(preferredTimezone);
    setIsNoEndDate(false);
    setIsDateRangeOpen(false);
  };

  const createNewSchedule = () => {
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
    <Dialog
      open={open}
      disablePointerDismissal={isDateRangeOpen}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setIsDateRangeOpen(false);
        }
      }}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("travel_schedule")}</DialogTitle>
          <DialogDescription>{t("travel_schedule_description")}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div>
            {!isNoEndDate ? (
              <>
                <Label className="mt-2">{t("time_range")}</Label>
                <DateRangePicker
                  dates={{
                    startDate,
                    endDate,
                  }}
                  popoverModal={isMobile}
                  onPopoverOpenChange={setIsDateRangeOpen}
                  onDatesChange={({ startDate: newStartDate, endDate: newEndDate }) => {
                    // If newStartDate does become undefined - we resort back to to-todays date
                    setStartDate(newStartDate ?? new Date());
                    setEndDate(newEndDate);
                    setErrorMessage("");
                  }}
                />
              </>
            ) : (
              <>
                <Label className="mt-2">{t("date")}</Label>
                <DatePicker
                  minDate={new Date()}
                  date={startDate}
                  className="w-56"
                  onDatesChange={(newDate) => {
                    setStartDate(newDate);
                    setErrorMessage("");
                  }}
                />
              </>
            )}
            <div className="text-error mt-1 text-sm">{errorMessage}</div>

            <Field className="mt-3">
              <FieldLabel>
                <Switch
                  checked={isNoEndDate}
                  onCheckedChange={(checked) => {
                    setEndDate(!checked ? startDate : undefined);
                    setIsNoEndDate(checked);
                    if (checked) {
                      setIsDateRangeOpen(false);
                    }
                    setErrorMessage("");
                  }}
                />
                {t("schedule_tz_without_end_date")}
              </FieldLabel>
            </Field>

            <Label className="mt-6">{t("timezone")}</Label>
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
                render={<Button className="mt-2 w-full justify-between font-normal" variant="outline" />}>
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
          </div>
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
