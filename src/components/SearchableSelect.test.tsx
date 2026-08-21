import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {SearchableSelect} from './SearchableSelect';

describe('SearchableSelect controlado', () => {
  it('limpia la etiqueta visible cuando el valor controlado se limpia', () => {
    const onChange = vi.fn();
    const {rerender} = render(
      <SearchableSelect
        name="siteId"
        label="Instalación"
        value="site-1"
        options={[{value: 'site-1', label: 'Planta anterior'}]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('searchbox', {name: 'Instalación'})).toHaveValue('Planta anterior');

    rerender(
      <SearchableSelect
        name="siteId"
        label="Instalación"
        value=""
        options={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('searchbox', {name: 'Instalación'})).toHaveValue('');
  });

  it('filtra iniciales sin acentos y permite seleccionar con teclado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        name="clientId"
        label="Cliente"
        options={[
          {value: '1', label: 'Álvaro Núñez', keywords: 'RFC-ÁN01 código-alvaro'},
          {value: '2', label: 'Servicios del Norte', keywords: 'RFC-SN02'},
        ]}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole('searchbox', {name: 'Cliente'});
    expect(input.parentElement).toHaveClass('searchable-select__control');
    expect(input.parentElement?.querySelectorAll('.searchable-select__chevron')).toHaveLength(1);
    expect(input.parentElement?.querySelectorAll('button')).toHaveLength(0);
    await user.type(input, 'alvaro');
    expect(screen.getByRole('option', {name: 'Álvaro Núñez'})).toBeVisible();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('1');
    expect(input).toHaveValue('Álvaro Núñez');
  });
});
