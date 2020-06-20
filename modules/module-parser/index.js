
const STANDARD_IMPORT = -1
const IMPORT_META = -2

const punctuators = {
  '!': true,
  '%': true,
  '&': true,
  '(': true,
  ')': true,
  '*': true,
  '+': true,
  ',': true,
  '-': true,
  '.': true,
  '/': true,
  ':': true,
  ';': true,
  '<': true,
  '=': true,
  '>': true,
  '?': true,
  '[': true,
  ']': true,
  '^': true,
  '{': true,
  '}': true,
  '|': true,
  '~': true
}

const expression_punctuators = {
  '!': true,
  '%': true,
  '&': true,
  '(': true,
  '*': true,
  '+': true,
  ',': true,
  '-': true,
  '.': true,
  ':': true,
  ';': true,
  '<': true,
  '=': true,
  '>': true,
  '?': true,
  '[': true,
  '^': true,
  '{': true,
  '|': true,
  '~': true
}

export default function parse (source) {
  let import_write_head = null
  let import_write_head_last = null
  let export_write_head = null

  let imports_list = []
  let exports_list = []

  let pos = -1
  let end = source.length
  let source_end = end

  let facade = true
  let template_stack_depth = 0
  let open_token_depth = 0
  let template_depth = -1
  let last_token_pos = -1
  let parse_error = 0
  let has_error = false
  let template_stack = []
  let open_token_pos_stack = []

  while (pos++ < end) {
    let ch = source[pos]

    if (ch == ' ' ||
        ch == '\b' ||
        ch == '\n' ||
        ch == '\r' ||
        ch == '\t') {
      continue
    }

    else if (keyword_start(pos) &&
        ch == 'e' &&
        source[pos+1] == 'x' &&
        source[pos+2] == 'p' &&
        source[pos+3] == 'o' &&
        source[pos+4] == 'r' &&
        source[pos+5] == 't') {
      try_parse_export_statement()
      if (!facade) {
        last_token_pos = pos
        main_parse()
        break
      }
    }

    else if (keyword_start(pos) &&
        ch == 'i' &&
        source[pos+1] == 'm' &&
        source[pos+2] == 'p' &&
        source[pos+3] == 'o' &&
        source[pos+4] == 'r' &&
        source[pos+5] == 't') {
      try_parse_import_statement()
    }

    else if (ch ==  '/') {
      let next_ch = source[pos+1]
      if (next_ch == '/') {
        line_comment()
        continue
      } else if (next_ch == '*') {
        block_comment()
        continue
      }
    }

    // as soon as we hit a non-module token, we go to main parser
    facade = false
    pos--
    main_parse()
    last_token_pos = pos
  }

  function add_import (statement_start, start, end, dynamic) {
    let current_import = {}

    if (import_write_head) {
      import_write_head.next = current_import
    }

    import_write_head_last = import_write_head
    import_write_head = current_import

    let statement_end
    if (dynamic == IMPORT_META) {
      statement_end = end
    }
    else if (dynamic == STANDARD_IMPORT) {
      statement_end = end + 1
    }
    else {
      statement_end = source_end
    }

    current_import.statement_start = statement_start
    current_import.statement_end = statement_end
    current_import.start = start
    current_import.end = end
    current_import.dynamic = dynamic
    current_import.next = null
    current_import.statement = source.substring(statement_start, statement_end)

    imports_list.push(current_import)
  }

  function add_export (start, end) {
    let current_export = {}

    if (export_write_head) {
      export_write_head.next = current_export
    }
    export_write_head = current_export

    current_export.start = start
    current_export.end = end
    current_export.next = null
    current_export.statement = source.substring(start, end)

    exports_list.push(current_export)
  }

  function main_parse () {
    while (pos++ < end) {
      let ch = source[pos]

      if (ch == ' ' ||
          ch == '\b' ||
          ch == '\n' ||
          ch == '\r' ||
          ch == '\t') {
        continue
      }

      else if (keyword_start(pos)) {
        if (ch == 'e' &&
            source[pos+1] == 'x' &&
            source[pos+2] == 'p' &&
            source[pos+3] == 'o' &&
            source[pos+4] == 'r' &&
            source[pos+5] == 't') {
          try_parse_export_statement()
        }

        else if (ch == 'i' &&
            source[pos+1] == 'm' &&
            source[pos+2] == 'p' &&
            source[pos+3] == 'o' &&
            source[pos+4] == 'r' &&
            source[pos+5] == 't') {
          try_parse_import_statement()
        }
      }

      else if (ch == '(') {
        open_token_depth++
        open_token_pos_stack[open_token_depth] = last_token_pos
      }

      else if (ch == ')') {
        if (open_token_depth == 0) {
          return syntax_error()
        }
        open_token_depth--
        if (import_write_head &&
            import_write_head.dynamic == open_token_pos_stack[open_token_depth]) {
          import_write_head.end = pos
        }
      }

      else if (ch == '{') {
        if (source[last_token_pos] == ')' &&
            import_write_head &&
            import_write_head.end == last_token_pos) {
          import_write_head = import_write_head_last
          if (import_write_head) {
            import_write_head.next = null
          } else {
            import_write_head = null
          }
        }
        open_token_depth++
        open_token_pos_stack[open_token_depth] = last_token_pos
      }

      else if (ch == '}') {
        if (open_token_depth-- == template_depth) {
          template_depth = template_stack[--template_stack_depth]
          template_string()
        } else if (open_token_depth < template_depth) {
          return syntax_error()
        }
      }

      else if (ch == '\'') {
        single_quote_string()
      }

      else if (ch == '"') {
        double_quote_string()
      }

      else if (ch == '/') {
        next_ch = source[pos + 1]
        if (next_ch == '/') {
          line_comment()
          // dont update lastToken
          continue
        }

        else if (next_ch == '*') {
          block_comment()
          // dont update lastToken
          continue
        }

        else {
          // Division / regex ambiguity handling based on checking backtrack analysis of:
          // - what token came previously (last_token)
          // - if a closing brace or paren, what token came before the corresponding
          //   opening brace or paren (last_open_token_index)
          let last_token = source[last_token_pos]
          let prev_last_token = source[last_token_pos-1]
          if (is_expression_punctuator(last_token) &&
              !(last_token == '+' && prev_last_token == '+') &&
              !(lastToken == '-' && prev_last_token == '-') || last_token == ')' &&
              is_parent_keyword(open_token_pos_stack[open_token_depth]) || last_token == '}' &&
              is_expression_terminator(open_token_pos_stack[open_token_depth]) ||
              is_expression_keyword(last_token_pos) ||
              !last_token) {

            regular_expression()
          }
        }
      }

      else if (ch == '`') {
        template_string()
      }
    }

    last_token_pos = pos
  }

  function try_parse_import_statement () {
    let start_pos = pos

    pos += 6

    let ch = comment_whitespace()

    // dynamic import
    if (ch == '(') {
      open_token_pos_stack[open_token_depth++] = start_pos
      if (source[last_token_pos] == '.') {
        return
      }
      // dynamic import indicated by positive d
      add_import(start_pos, pos + 1, 0, start_pos)
      return
    }

    // import.meta
    if (ch == '.') {
      pos++
      ch = comment_whitespace()
      if (ch == 'm' &&
          source[pos+1] == 'e' &&
          source[pos+2] == 't' &&
          source[pos+3] == 'a' &&
          source[last_token_pos] != '.') {
        add_import(start_pos, start_pos, pos + 4, IMPORT_META)
        return
      }
    }

    let punctuator = (ch == '"' || ch == '\'' || ch == '{' || ch == '*')

    if (!punctuator && pos == start_pos + 6) {
      return
    }

    else {
      // import statement only permitted at base-level
      if (open_token_depth != 0) {
        pos--
        return
      }
      while (pos < end) {
        ch = source[pos]
        if (ch == '\'' || ch == '"') {
          read_import_string(start_pos, ch)
          return
        }
        pos++
      }
      syntax_error()
    }
  }

  function try_parse_export_statement () {
    let s_start_pos = pos

    pos += 6

    let cur_pos = pos

    let ch = comment_whitespace()

    if (pos == cur_pos && !is_punctuator(ch)) {
      return
    }

    // export default ...
    if (ch == 'd') {
      add_export(pos, pos + 7)
      return
    }

    switch (ch) {

      // export async? function*? name () {
      case 'a': {
        pos += 5
        comment_whitespace()
      }

      // fallthrough
      case 'f': {
        pos += 8
        ch = comment_whitespace()
        if (ch == '*') {
          pos++
          ch = comment_whitespace()
        }
        let start_pos = pos
        ch = read_to_ws_or_punctuator(ch)
        add_export(start_pos, pos)
        pos--
        return
      }

      case 'c': {
        if (source[pos+1] == 'l' &&
            source[pos+2] == 'a' &&
            source[pos+3] == 's' &&
            source[pos+4] == 's' &&
            is_br_or_ws_or_punctuator_not_dot(pos+5)) {
          pos += 5
          ch = comment_whitespace()
          let start_pos = pos
          ch = read_to_ws_or_punctuator(ch)
          add_export(start_pos, pos)
          pos--
          return
        }
        pos += 2
      }

      // fallthrough
      // export var/let/const name = ...(, name = ...)+
      case 'v':
      case 'l': {
        // destructured initializations not currently supported (skipped for { or [)
        // also, lexing names after variable equals is skipped (export var p = function () { ... }, q = 5 skips "q")
        pos += 2
        facade = false
        do {
          pos++
          ch = comment_whitespace()
          let start_pos = pos
          ch = read_to_ws_or_punctuator(ch)
          // stops on [ { destructurings or =
          if (ch == '{' || ch == '[' || ch == '=') {
            pos--
            return
          }
          if (pos == start_pos) {
            return
          }
          add_export(start_pos, pos)
          ch = comment_whitespace()
        } while (ch == ',')
        pos--
        return
      }

      // export {...}
      case '{': {
        pos++
        ch = comment_whitespace()
        while (true) {
          let start_pos = pos
          read_to_ws_or_punctuator(ch)
          let end_pos = pos
          comment_whitespace()
          ch = read_export_as(start_pos, end_pos)
          // ,
          if (ch == ',') {
            pos++
            ch = comment_whitespace()
          }
          if (ch == '}') {
            break
          }
          if (pos == startPos) {
            return syntax_error()
          }
          if (pos > end) {
            return syntax_error()
          }
        }
        pos++
        ch = comment_whitespace()
        break
      }

      // export *
      // export * as X
      case '*':
        pos++
        comment_whitespace()
        ch = read_export_as(pos, pos)
        ch = comment_whitespace()
      break
    }

    // from ...
    if (ch == 'f' &&
        source[pos+1] == 'r' &&
        source[pos+2] == 'o' &&
        source[pos+3] == 'm') {
      pos += 4
      ch = comment_whitespace()
      read_import_string(s_start_pos, ch)
    }
    else {
      pos--
    }
  }

  function read_export_as (start_pos, end_pos) {
    let ch = source[pos]

    if (ch == 'a') {
      pos += 2
      ch = comment_whitespace()
      start_pos = pos
      read_to_ws_or_punctuator(ch)
      end_pos = pos
      ch = commentWhitespace()
    }
    if (pos != start_pos) {
      add_export(start_pos, end_pos)
    }
    return ch
  }

  function read_import_string (ss, ch) {
    if (ch == '\'') {
      let start_pos = pos + 1
      single_quote_string()
      add_import(ss, start_pos, pos, STANDARD_IMPORT)
    } else if (ch == '"') {
      let start_pos = pos + 1
      double_quote_string()
      add_import(ss, start_pos, pos, STANDARD_IMPORT)
    } else {
      syntax_error()
    }
  }

  function comment_whitespace () {
    let ch
    do {
      ch = source[pos]
      if (ch == '/') {
        let next_ch = source[pos + 1]
        if (next_ch == '/') {
          line_comment()
        }
        else if (next_ch == '*') {
          block_comment()
        }
        return ch
      }
      else if (!is_br_or_ws(ch)) {
        return ch
      }
    } while (pos++ < end)
    return ch
  }

  function template_string () {
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == '$' &&
          source[pos+1] == '{') {
        pos++
        template_stack[template_stack_depth++] = template_depth
        template_depth = ++open_token_depth
        return
      }
      if (ch == '`') {
        return
      }
      if (ch == '\\') {
        pos++
      }
    }
    syntax_error()
  }

  function block_comment () {
    pos++
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == '*' &&
          source[pos+1] == '/') {
        pos++
        return
      }
    }
  }

  function line_comment () {
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == '\n' || ch == '\r') {
        return
      }
    }
  }

  function single_quote_string () {
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == '\'') {
        return
      }
      if (ch == '\\') {
        pos++
      }
      else if (is_br(ch)) {
        break
      }
    }
    syntax_error()
  }

  function double_quote_string () {
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == '"') {
        //close quote and return
        // pos++
        return
      }
      if (ch == '\\') {
        pos++
      }
      else if (is_br(ch)) {
        break
      }
    }
    syntax_error()
  }

  function regex_character_class () {
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == ']') {
        return ch
      }
      if (ch == '\\') {
        pos++
      }
      else if (ch == '\n' || ch == '\r') {
        break
      }
    }
    syntax_error()
    return '\0'
  }

  function regular_expression () {
    while (pos++ < end) {
      let ch = source[pos]
      if (ch == '/') {
        return
      }
      if (ch == '[') {
        ch = regex_character_class()
      }
      else if (ch == '\\') {
        pos++
      }
      else if (ch == '\n' || ch == '\r') {
        break
      }
    }
    syntax_error()
  }

  function read_to_ws_or_punctuator (ch) {
    do {
      if (is_br_or_ws(ch) || is_punctuator(ch)) {
        return ch
      }
    } while (ch = source[++pos])
    return ch
  }

  function is_br (ch) {
    return ch == '\r' || ch == '\n'
  }

  function is_br_or_ws (ch) {
    let code = ch.charCodeAt(0)
    return code > 8 && code < 14 || code == 32 || code == 160
  }

  function is_br_or_ws_or_punctuator_not_dot (ch) {
    let code = ch.charCodeAt(0)
    return is_br_or_ws(ch) || is_punctuator(ch) && ch != '.'
  }

  function is_expression_keyword (pos) {
    let ch = source[pos]

    if (ch == 'd') {
      let ch_1 = source[pos-1]
      if (ch_1 == 'i') {
        //void
        return source[pos-2] == 'o' &&
            source[pos-3] == 'v' &&
            keyword_start(pos-3)
      }
      else if (ch_1 == 'l') {
        //yield
        return source[pos-2] == 'e' &&
            source[pos-3] == 'i' &&
            source[pos-4] == 'y' &&
            keyword_start(pos-4)
      }
      return false
    }

    if (ch == 'e') {
      let ch_1 = source[pos-1]
      if (ch_1 == 's') {
        let ch_2 = source[pos-2]
        if (ch_2 == 'l') {
          //else
          return source[pos-3] == 'e' &&
            keyword_start(pos-3)
        }
        if (ch_2 == 'a') {
          //case
          return source[pos-3] == 'c' &&
            keyword_start(pos-3)
        }
        return false
      }

      if (ch_1 == 't') {
        //delete
        return source[pos-2] == 'e' &&
            source[pos-3] == 'l' &&
            source[pos-4] == 'e' &&
            source[pos-5] == 'd' &&
            keyword_start(pos-5)
      }

      return false
    }

    if (ch == 'f') {
      if (source[pos-1] == 'o') {
        if (source[pos-2] == 'e') {
          let ch_3 = source[pos-3]
          if (ch_3 == 'c') {
            //instanceof
            return source[pos-4] == 'n' &&
                source[pos-5] == 'a' &&
                source[pos-6] == 't' &&
                source[pos-7] == 's' &&
                source[pos-8] == 'n' &&
                source[pos-9] == 'i' &&
                keyword_start(pos-9)
          }
          if (ch_3 == 'p') {
            //typeof
            return source[pos-4] == 't' &&
                source[pos-5] == 'y' &&
                keyword_start(pos-4)
          }
        }
      }
      return false
    }

    if (ch == 'n') {
      //in or return
      return source[pos-1] == 'i' ||
          source[pos-1] == 'r' &&
          source[pos-2] == 'u' &&
          source[pos-3] == 't' &&
          source[pos-4] == 'e' &&
          source[pos-5] == 'r' &&
          keyword_start(pos-5)
    }

    if (ch == 'o') {
      // do
      return source[pos-1] == 'd' &&
        keyword_start(pos-1)
    }

    if (ch == 'r') {
      // debugger
      return source[pos-1] == 'e' &&
          source[pos-2] == 'g' &&
          source[pos-3] == 'g' &&
          source[pos-4] == 'u' &&
          source[pos-5] == 'b' &&
          source[pos-6] == 'e' &&
          source[pos-7] == 'd' &&
          keyword_start(pos-7)
    }

    if (ch == 't') {
      // await
      return source[pos-1] == 'i' &&
          source[pos-2] == 'a' &&
          source[pos-3] == 'w' &&
          source[pos-4] == 'a' &&
          keyword_start(pos-4)
    }

    if (ch == 'w') {
      let ch_1 = source[pos-1]
      if (ch_1 == 'e') {
        //new
        return source[pos-2] == 'n' &&
          keyword_start(pos-2)
      }
      if (ch_1 == 'o') {
        // throw
        return source[pos-2] == 'r' &&
          source[pos-3] == 'h' &&
          source[pos-4] == 't' &&
          keyword_start(pos-4)
      }
      return false
    }

    return false
  }

  function keyword_start (pos) {
    return pos == 0 || is_br_or_ws_or_punctuator_not_dot(source[pos-1])
  }

  function is_parent_keyword (pos) {
    let ch = source[pos]

    if (ch == 'e') {
      return source[pos-1] == 'l' &&
        source[pos-2] == 'i' &&
        source[pos-3] == 'h' &&
        source[pos-4] == 'w' &&
        keyword_start(pos-4)
    }

    if (ch == 'r') {
      return source[pos-1] == 'o' &&
        source[pos-2] == 'f' &&
        keyword_start(pos-2)
    }

    if (ch == 'f') {
      return source[pos-1] == 'i' &&
      keyword_start(pos-1)
    }

    return false
  }

  function is_punctuator (ch) {
    return punctuators[ch] == true
  }

  function is_expression_punctuator (ch) {
    return expression_punctuators[ch] == true
  }

  function is_expression_terminator (pos) {
    // detects:
    // ; ) -1 finally catch
    // as all of these followed by a { will indicate a statement brace
    let ch = source[pos]

    if (ch == ';' || ch == ')') {
      return true
    }

    if (ch == 'h') {
      //catch
      return source[pos-1] == 'c' &&
          source[pos-2] == 't' &&
          source[pos-3] == 'a' &&
          source[pos-4] == 'c' &&
          keyword_start(pos-4)
    }

    if (ch == 'y') {
      //finally
      return source[pos-1] == 'l' &&
          source[pos-2] == 'l' &&
          source[pos-3] == 'a' &&
          source[pos-4] == 'n' &&
          source[pos-5] == 'i' &&
          source[pos-6] == 'f' &&
          keyword_start(pos-6)
    }

    return false
  }

  function syntax_error () {
    console.warn('syntax error!')
    has_error = true
    pos = end + 1
  }

  function exit (ok) {
    if (!ok) {
      console.warn('something went wrong!')
    }
    return [imports_list, exports_list]
  }

  if (has_error) {
    return exit(false)
  }

  if (template_depth != -1 || open_token_depth || has_error) {
    return exit(false)
  }

  // succeess
  return exit(true)
}
