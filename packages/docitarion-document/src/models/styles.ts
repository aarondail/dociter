export const TODO = 0;
// pub enum StyleElementType {
//     Header1,
//     Header2,
//     Header3,
//     HeaderMinor,
//     Body,
//     Link,
//     InlineQuote,
//     BlockQuote,
//     Emphasis,
//     Subtle,
//     InternalThinking,
//     TechnicalTerm,
//     Floater,
//     FloaterNested(StyleElementType),
//     ListItem(StyleElementType),
//     Sidebar(StyleElementType),
// }

// pub enum FontWeight {
//     Invisible = 0,
//     Thin = 100,
//     ExtraLight = 200,
//     Light = 300,
//     Normal = 400,
//     Medium = 500,
//     SemiBold = 600,
//     Bold = 700,
//     ExtraBold = 800,
//     Black = 900,
//     ExtraBlack = 1000,
// }

// pub enum TextDecoration {
//     None,
//     Underline,
//     Strikethrough,
// }

// pub enum FontVariant {
//     Normal,
//     SmallCaps,
// }

// pub struct PartialStyle {
//     font_family: Option<FontFamilyName>,
//     font_size: Option<FontSize>,
//     weight: Option<FontWeight>,
//     italic: Option<bool>,
//     varaint: Option<FontVariant>,
//     decoration: Option<TextDecoration>,
//     // color, outline, underline, shader... etc
// }

// pub struct Style {
//     font_family: FontFamilyName,
//     font_size: FontSize,
//     weight: FontWeight,
//     italic: bool,
//     varaint: FontVariant,
//     decoration: TextDecoration,
//     // color, outline, underline, shader... etc
// }

// pub type PartialStyleSet = HashMap<StyleElementType, Option<PartialStyle>>;

// pub struct StyleNode {
//     key: usize,
//     parent_key: Option<usize>,
//     styles: PartialStyleSet,
// }

// pub struct StyleTree {
//     styles: Vec<StyleNode>,
// }

// pub type ResolvedStyleSet = HashMap<StyleElementType, Style>;
//
//
//
