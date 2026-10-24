"use client";

import { useMemo, useRef, useState } from "react";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import {
  menuLocaleSchema,
  translationTemplate,
  type MenuTranslation,
  type MenuTranslationDocument,
} from "@/modules/menu-product/translations";

type Props = {
  menuId: string;
  outletId: string;
  sourceRevision: number;
  source: MenuDocument;
  initial: MenuTranslation[];
  disabled: boolean;
  onSaved: (translations: MenuTranslation[]) => void;
};

export function TranslationEditor(props: Props) {
  const [localeInput, setLocaleInput] = useState(props.initial[0]?.locale ?? "");
  const [document, setDocument] = useState<MenuTranslationDocument>(() => {
    const existing = props.initial[0];
    return existing && existing.sourceRevision === props.sourceRevision
      ? existing.document
      : translationTemplate(props.source);
  });
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const locale = useMemo(() => {
    const parsed = menuLocaleSchema.safeParse(localeInput);
    return parsed.success ? parsed.data : null;
  }, [localeInput]);
  const existing = props.initial.find((translation) => translation.locale === locale);

  function select(value: string) {
    setLocaleInput(value);
    const parsed = menuLocaleSchema.safeParse(value);
    const found = parsed.success
      ? props.initial.find((translation) => translation.locale === parsed.data)
      : undefined;
    setDocument(
      found && found.sourceRevision === props.sourceRevision
        ? found.document
        : translationTemplate(props.source)
    );
    setReviewed(false);
    setNotice("");
    key.current = crypto.randomUUID();
  }

  function category(
    index: number,
    update: (
      value: MenuTranslationDocument["categories"][number]
    ) => MenuTranslationDocument["categories"][number]
  ) {
    setDocument((current) => ({
      ...current,
      categories: current.categories.map((value, item) => (item === index ? update(value) : value)),
    }));
    setReviewed(false);
  }

  async function save() {
    if (!locale || !reviewed || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/catalog/${encodeURIComponent(props.menuId)}/translations`,
        {
          method: "PUT",
          headers: { "content-type": "application/json", "x-outlet-id": props.outletId },
          body: JSON.stringify({
            key: key.current,
            locale,
            sourceRevision: props.sourceRevision,
            expectedRevision: existing?.revision ?? 0,
            reviewConfirmed: true,
            document,
          }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "Translation could not be saved.");
      const refreshed = await fetch(
        `/api/catalog/${encodeURIComponent(props.menuId)}/translations`,
        { headers: { "x-outlet-id": props.outletId }, cache: "no-store" }
      );
      if (!refreshed.ok)
        throw new Error("Translation saved, but its status could not be refreshed.");
      const next = (await refreshed.json()) as MenuTranslation[];
      props.onSaved(next);
      key.current = crypto.randomUUID();
      setReviewed(false);
      setNotice("Reviewed translation saved for the current published revision.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Translation could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="atelier-translation stack" aria-labelledby="translation-title">
      <div>
        <span className="atelier-eyebrow">REVIEWED LOCALIZATION</span>
        <h2 id="translation-title">Translate the published menu.</h2>
        <p className="quiet">
          Only display text is translated. Prices, choices, availability, schedules and dietary
          facts always stay canonical. Publishing a new source revision makes older translations
          unavailable until they are reviewed again.
        </p>
      </div>
      {!props.sourceRevision ? (
        <p className="error">Publish the canonical menu before adding a guest translation.</p>
      ) : (
        <>
          <div className="columns">
            <label className="field">
              Language tag
              <input
                list="menu-translation-locales"
                value={localeInput}
                onChange={(event) => select(event.target.value)}
                placeholder="fr or hi-IN"
                autoComplete="off"
              />
            </label>
            <datalist id="menu-translation-locales">
              {props.initial.map((translation) => (
                <option key={translation.locale} value={translation.locale} />
              ))}
            </datalist>
            <div className="field">
              <span>Source</span>
              <strong>Published revision {props.sourceRevision}</strong>
              {existing && (
                <small>
                  Translation revision {existing.revision}
                  {existing.stale ? " · stale" : " · current"}
                </small>
              )}
            </div>
          </div>
          {locale && (
            <fieldset disabled={props.disabled || busy} className="stack">
              <label className="field">
                Translated menu name
                <input
                  required
                  maxLength={100}
                  value={document.name}
                  onChange={(event) => {
                    setDocument((value) => ({ ...value, name: event.target.value }));
                    setReviewed(false);
                  }}
                />
              </label>
              <label className="field">
                Translated storefront headline
                <input
                  maxLength={110}
                  value={document.headline}
                  onChange={(event) => {
                    setDocument((value) => ({ ...value, headline: event.target.value }));
                    setReviewed(false);
                  }}
                />
              </label>
              {document.categories.map((section, sectionIndex) => (
                <details key={section.id} className="atelier-translation-section">
                  <summary>{section.name}</summary>
                  <label className="field">
                    Section name
                    <input
                      required
                      maxLength={100}
                      value={section.name}
                      onChange={(event) =>
                        category(sectionIndex, (value) => ({ ...value, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    Section description
                    <textarea
                      maxLength={500}
                      value={section.description}
                      onChange={(event) =>
                        category(sectionIndex, (value) => ({
                          ...value,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {section.items.map((dish, dishIndex) => (
                    <div key={dish.id} className="atelier-translation-dish stack">
                      <label className="field">
                        Dish name
                        <input
                          required
                          maxLength={100}
                          value={dish.name}
                          onChange={(event) =>
                            category(sectionIndex, (value) => ({
                              ...value,
                              items: value.items.map((item, index) =>
                                index === dishIndex ? { ...item, name: event.target.value } : item
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        Dish description
                        <textarea
                          maxLength={1000}
                          value={dish.description}
                          onChange={(event) =>
                            category(sectionIndex, (value) => ({
                              ...value,
                              items: value.items.map((item, index) =>
                                index === dishIndex
                                  ? { ...item, description: event.target.value }
                                  : item
                              ),
                            }))
                          }
                        />
                      </label>
                      {dish.variants.map((variant, variantIndex) => (
                        <label className="field" key={variant.id}>
                          Variant
                          <input
                            required
                            maxLength={100}
                            value={variant.name}
                            onChange={(event) =>
                              category(sectionIndex, (value) => ({
                                ...value,
                                items: value.items.map((item, index) =>
                                  index === dishIndex
                                    ? {
                                        ...item,
                                        variants: item.variants.map((option, optionIndex) =>
                                          optionIndex === variantIndex
                                            ? { ...option, name: event.target.value }
                                            : option
                                        ),
                                      }
                                    : item
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                      {dish.addOnGroups.map((group, groupIndex) => (
                        <div key={group.id} className="columns">
                          <label className="field">
                            Add-on group
                            <input
                              required
                              maxLength={100}
                              value={group.name}
                              onChange={(event) =>
                                category(sectionIndex, (value) => ({
                                  ...value,
                                  items: value.items.map((item, index) =>
                                    index === dishIndex
                                      ? {
                                          ...item,
                                          addOnGroups: item.addOnGroups.map((entry, entryIndex) =>
                                            entryIndex === groupIndex
                                              ? { ...entry, name: event.target.value }
                                              : entry
                                          ),
                                        }
                                      : item
                                  ),
                                }))
                              }
                            />
                          </label>
                          {group.options.map((option, optionIndex) => (
                            <label className="field" key={option.id}>
                              Add-on option
                              <input
                                required
                                maxLength={100}
                                value={option.name}
                                onChange={(event) =>
                                  category(sectionIndex, (value) => ({
                                    ...value,
                                    items: value.items.map((item, index) =>
                                      index === dishIndex
                                        ? {
                                            ...item,
                                            addOnGroups: item.addOnGroups.map(
                                              (entry, entryIndex) =>
                                                entryIndex === groupIndex
                                                  ? {
                                                      ...entry,
                                                      options: entry.options.map(
                                                        (choice, choiceIndex) =>
                                                          choiceIndex === optionIndex
                                                            ? {
                                                                ...choice,
                                                                name: event.target.value,
                                                              }
                                                            : choice
                                                      ),
                                                    }
                                                  : entry
                                            ),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </details>
              ))}
              <label className="atelier-review-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I reviewed this translation against published revision {props.sourceRevision}.
              </label>
              <button type="button" className="ember" disabled={!reviewed || busy} onClick={save}>
                {busy ? "Saving reviewed translation…" : "Save reviewed translation"}
              </button>
            </fieldset>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
