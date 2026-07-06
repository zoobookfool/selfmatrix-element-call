/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type ChangeEvent, type FC, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Heading,
  InlineField,
  Label,
  RadioControl,
  Root as Form,
  Text,
} from "@vector-im/compound-web";

import type { TFunction } from "i18next";
import { FieldRow, InputField } from "../input/Input";
import {
  showHandRaisedTimer as showHandRaisedTimerSetting,
  showReactions as showReactionsSetting,
  playReactionsSound as playReactionsSoundSetting,
  developerMode as developerModeSetting,
  miniTileStripPosition as miniTileStripPositionSetting,
  type MiniTileStripPosition,
  useSetting,
} from "./settings";

const stripPositions: MiniTileStripPosition[] = [
  "top",
  "bottom",
  "left",
  "right",
];

// SelfMatrix: i18next-parser can only statically extract t() calls whose
// first argument is a string literal, so building the key dynamically with a
// template literal is invisible to it and gets pruned from
// locales/en/app.json by `pnpm i18n`. Look up the literal key per position
// instead of constructing it at runtime.
function miniTileStripPositionLabel(
  t: TFunction,
  position: MiniTileStripPosition,
): string {
  switch (position) {
    case "bottom":
      return t("settings.preferences_tab.mini_tile_strip_position.bottom");
    case "left":
      return t("settings.preferences_tab.mini_tile_strip_position.left");
    case "right":
      return t("settings.preferences_tab.mini_tile_strip_position.right");
    case "top":
      return t("settings.preferences_tab.mini_tile_strip_position.top");
  }
}

export const PreferencesSettingsTab: FC = () => {
  const { t } = useTranslation();
  const [showHandRaisedTimer, setShowHandRaisedTimer] = useSetting(
    showHandRaisedTimerSetting,
  );

  const [showReactions, setShowReactions] = useSetting(showReactionsSetting);

  const [playReactionsSound, setPlayReactionSound] = useSetting(
    playReactionsSoundSetting,
  );

  const onChangeSetting = (
    e: ChangeEvent<HTMLInputElement>,
    fn: (value: boolean) => void,
  ): void => {
    fn(e.target.checked);
  };

  const [developerMode, setDeveloperMode] = useSetting(developerModeSetting);

  const [miniTileStripPosition, setMiniTileStripPosition] = useSetting(
    miniTileStripPositionSetting,
  );
  const miniTileStripPositionRadioGroup = useId();
  const onMiniTileStripPositionChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setMiniTileStripPosition(e.target.value as MiniTileStripPosition);
    },
    [setMiniTileStripPosition],
  );

  return (
    <div>
      <Text>{t("settings.preferences_tab.introduction")}</Text>
      <FieldRow>
        <InputField
          id="showHandRaisedTimer"
          label={t("settings.preferences_tab.show_hand_raised_timer_label")}
          description={t(
            "settings.preferences_tab.show_hand_raised_timer_description",
          )}
          type="checkbox"
          checked={showHandRaisedTimer}
          onChange={(e) => onChangeSetting(e, setShowHandRaisedTimer)}
        />
      </FieldRow>
      <FieldRow>
        <InputField
          id="showReactions"
          label={t("settings.preferences_tab.reactions_show_label")}
          description={t("settings.preferences_tab.reactions_show_description")}
          type="checkbox"
          checked={showReactions}
          onChange={(e) => onChangeSetting(e, setShowReactions)}
        />
      </FieldRow>
      <FieldRow>
        <InputField
          id="playReactionSound"
          label={t("settings.preferences_tab.reactions_play_sound_label")}
          description={t(
            "settings.preferences_tab.reactions_play_sound_description",
          )}
          type="checkbox"
          checked={playReactionsSound}
          onChange={(e) => onChangeSetting(e, setPlayReactionSound)}
        />
      </FieldRow>
      <FieldRow>
        <InputField
          id="developerSettingsTab"
          type="checkbox"
          checked={developerMode}
          label={t("settings.preferences_tab.developer_mode_label")}
          description={t(
            "settings.preferences_tab.developer_mode_label_description",
          )}
          onChange={(event: ChangeEvent<HTMLInputElement>): void =>
            setDeveloperMode(event.target.checked)
          }
        />
      </FieldRow>
      <Heading as="h3" type="body" weight="semibold" size="lg">
        {t("settings.preferences_tab.mini_tile_strip_position_title")}
      </Heading>
      <Text size="sm">
        {t("settings.preferences_tab.mini_tile_strip_position_description")}
      </Text>
      <Form>
        {stripPositions.map((position) => (
          <InlineField
            key={position}
            name={miniTileStripPositionRadioGroup}
            control={
              <RadioControl
                checked={miniTileStripPosition === position}
                value={position}
                onChange={onMiniTileStripPositionChange}
              />
            }
          >
            <Label>{miniTileStripPositionLabel(t, position)}</Label>
          </InlineField>
        ))}
      </Form>
    </div>
  );
};
