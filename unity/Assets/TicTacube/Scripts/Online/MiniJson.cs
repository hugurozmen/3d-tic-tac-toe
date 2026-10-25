using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace TicTacube.Online
{
    /// <summary>
    /// Minimal JSON parser/serializer for the online room protocol.
    /// Unity's JsonUtility cannot represent the protocol's nullable board
    /// cells and union-shaped messages, so messages are parsed into plain
    /// Dictionary&lt;string, object&gt; / List&lt;object&gt; trees instead.
    /// Numbers parse as double, and null/true/false/string as themselves.
    /// </summary>
    public static class MiniJson
    {
        public static object Parse(string json)
        {
            if (string.IsNullOrEmpty(json))
            {
                return null;
            }

            int index = 0;
            var value = ParseValue(json, ref index);
            SkipWhitespace(json, ref index);

            if (index != json.Length)
            {
                throw new FormatException("Trailing characters after JSON value at " + index);
            }

            return value;
        }

        public static bool TryParse(string json, out object value)
        {
            try
            {
                value = Parse(json);
                return true;
            }
            catch (Exception)
            {
                value = null;
                return false;
            }
        }

        private static void SkipWhitespace(string json, ref int index)
        {
            while (index < json.Length)
            {
                char c = json[index];

                if (c == ' ' || c == '\t' || c == '\n' || c == '\r')
                {
                    index += 1;
                }
                else
                {
                    break;
                }
            }
        }

        private static object ParseValue(string json, ref int index)
        {
            SkipWhitespace(json, ref index);

            if (index >= json.Length)
            {
                throw new FormatException("Unexpected end of JSON");
            }

            char c = json[index];

            switch (c)
            {
                case '{':
                    return ParseObject(json, ref index);
                case '[':
                    return ParseArray(json, ref index);
                case '"':
                    return ParseString(json, ref index);
                case 't':
                    Expect(json, ref index, "true");
                    return true;
                case 'f':
                    Expect(json, ref index, "false");
                    return false;
                case 'n':
                    Expect(json, ref index, "null");
                    return null;
                default:
                    return ParseNumber(json, ref index);
            }
        }

        private static void Expect(string json, ref int index, string token)
        {
            if (index + token.Length > json.Length || json.Substring(index, token.Length) != token)
            {
                throw new FormatException("Invalid literal at " + index);
            }

            index += token.Length;
        }

        private static Dictionary<string, object> ParseObject(string json, ref int index)
        {
            var result = new Dictionary<string, object>();
            index += 1; // '{'
            SkipWhitespace(json, ref index);

            if (index < json.Length && json[index] == '}')
            {
                index += 1;
                return result;
            }

            while (true)
            {
                SkipWhitespace(json, ref index);

                if (index >= json.Length || json[index] != '"')
                {
                    throw new FormatException("Expected object key at " + index);
                }

                string key = ParseString(json, ref index);
                SkipWhitespace(json, ref index);

                if (index >= json.Length || json[index] != ':')
                {
                    throw new FormatException("Expected ':' at " + index);
                }

                index += 1;
                result[key] = ParseValue(json, ref index);
                SkipWhitespace(json, ref index);

                if (index >= json.Length)
                {
                    throw new FormatException("Unterminated object");
                }

                if (json[index] == ',')
                {
                    index += 1;
                    continue;
                }

                if (json[index] == '}')
                {
                    index += 1;
                    return result;
                }

                throw new FormatException("Expected ',' or '}' at " + index);
            }
        }

        private static List<object> ParseArray(string json, ref int index)
        {
            var result = new List<object>();
            index += 1; // '['
            SkipWhitespace(json, ref index);

            if (index < json.Length && json[index] == ']')
            {
                index += 1;
                return result;
            }

            while (true)
            {
                result.Add(ParseValue(json, ref index));
                SkipWhitespace(json, ref index);

                if (index >= json.Length)
                {
                    throw new FormatException("Unterminated array");
                }

                if (json[index] == ',')
                {
                    index += 1;
                    continue;
                }

                if (json[index] == ']')
                {
                    index += 1;
                    return result;
                }

                throw new FormatException("Expected ',' or ']' at " + index);
            }
        }

        private static string ParseString(string json, ref int index)
        {
            var builder = new StringBuilder();
            index += 1; // '"'

            while (true)
            {
                if (index >= json.Length)
                {
                    throw new FormatException("Unterminated string");
                }

                char c = json[index];
                index += 1;

                if (c == '"')
                {
                    return builder.ToString();
                }

                if (c != '\\')
                {
                    builder.Append(c);
                    continue;
                }

                if (index >= json.Length)
                {
                    throw new FormatException("Unterminated escape");
                }

                char escape = json[index];
                index += 1;

                switch (escape)
                {
                    case '"':
                        builder.Append('"');
                        break;
                    case '\\':
                        builder.Append('\\');
                        break;
                    case '/':
                        builder.Append('/');
                        break;
                    case 'b':
                        builder.Append('\b');
                        break;
                    case 'f':
                        builder.Append('\f');
                        break;
                    case 'n':
                        builder.Append('\n');
                        break;
                    case 'r':
                        builder.Append('\r');
                        break;
                    case 't':
                        builder.Append('\t');
                        break;
                    case 'u':
                        if (index + 4 > json.Length)
                        {
                            throw new FormatException("Invalid unicode escape");
                        }

                        builder.Append((char)ushort.Parse(json.Substring(index, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        index += 4;
                        break;
                    default:
                        throw new FormatException("Invalid escape '\\" + escape + "'");
                }
            }
        }

        private static object ParseNumber(string json, ref int index)
        {
            int start = index;

            if (index < json.Length && json[index] == '-')
            {
                index += 1;
            }

            while (index < json.Length)
            {
                char c = json[index];

                if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-')
                {
                    index += 1;
                }
                else
                {
                    break;
                }
            }

            string token = json.Substring(start, index - start);
            double parsed;

            if (!double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed))
            {
                throw new FormatException("Invalid number '" + token + "' at " + start);
            }

            return parsed;
        }

        // ------------------------------------------------------------------
        // Serializer
        // ------------------------------------------------------------------

        public static string Serialize(object value)
        {
            var builder = new StringBuilder();
            WriteValue(builder, value);
            return builder.ToString();
        }

        private static void WriteValue(StringBuilder builder, object value)
        {
            if (value == null)
            {
                builder.Append("null");
                return;
            }

            if (value is string)
            {
                WriteString(builder, (string)value);
                return;
            }

            if (value is bool)
            {
                builder.Append((bool)value ? "true" : "false");
                return;
            }

            if (value is int || value is long)
            {
                builder.Append(Convert.ToInt64(value).ToString(CultureInfo.InvariantCulture));
                return;
            }

            if (value is float || value is double)
            {
                builder.Append(Convert.ToDouble(value).ToString("R", CultureInfo.InvariantCulture));
                return;
            }

            var dictionary = value as IDictionary<string, object>;

            if (dictionary != null)
            {
                builder.Append('{');
                bool first = true;

                foreach (var pair in dictionary)
                {
                    if (!first)
                    {
                        builder.Append(',');
                    }

                    first = false;
                    WriteString(builder, pair.Key);
                    builder.Append(':');
                    WriteValue(builder, pair.Value);
                }

                builder.Append('}');
                return;
            }

            var list = value as System.Collections.IEnumerable;

            if (list != null)
            {
                builder.Append('[');
                bool first = true;

                foreach (var item in list)
                {
                    if (!first)
                    {
                        builder.Append(',');
                    }

                    first = false;
                    WriteValue(builder, item);
                }

                builder.Append(']');
                return;
            }

            throw new NotSupportedException("Cannot serialize " + value.GetType());
        }

        private static void WriteString(StringBuilder builder, string value)
        {
            builder.Append('"');

            foreach (char c in value)
            {
                switch (c)
                {
                    case '"':
                        builder.Append("\\\"");
                        break;
                    case '\\':
                        builder.Append("\\\\");
                        break;
                    case '\b':
                        builder.Append("\\b");
                        break;
                    case '\f':
                        builder.Append("\\f");
                        break;
                    case '\n':
                        builder.Append("\\n");
                        break;
                    case '\r':
                        builder.Append("\\r");
                        break;
                    case '\t':
                        builder.Append("\\t");
                        break;
                    default:
                        if (c < ' ')
                        {
                            builder.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            builder.Append(c);
                        }

                        break;
                }
            }

            builder.Append('"');
        }
    }
}
